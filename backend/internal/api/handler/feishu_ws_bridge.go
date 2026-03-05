package handler

import (
	"context"
	"encoding/json"
	"log"
	"net/url"
	"strings"
	"time"

	"github.com/gorilla/websocket"
	"github.com/lea/echocenter/backend/internal/butler"
)

const feishuWSReadTimeout = 90 * time.Second

// StartFeishuWebSocketBridge starts Feishu long-connection consumption.
// It is best-effort and never returns an error to caller.
func (h *Handler) StartFeishuWebSocketBridge(ctx context.Context, wsURL string, reconnectInterval time.Duration) {
	wsURL = strings.TrimSpace(wsURL)
	if wsURL == "" {
		log.Println("[FeishuWS] Disabled: empty FEISHU_WS_URL")
		return
	}
	if reconnectInterval <= 0 {
		reconnectInterval = 5 * time.Second
	}

	log.Printf("[FeishuWS] Bridge started (url=%s reconnect=%s)", wsURL, reconnectInterval)

	for {
		select {
		case <-ctx.Done():
			log.Println("[FeishuWS] Bridge stopped")
			return
		default:
		}

		connector, err := h.repo.GetFeishuConnector(ctx)
		if err != nil {
			log.Printf("[FeishuWS] Failed to load connector: %v", err)
			sleepWithContext(ctx, reconnectInterval)
			continue
		}
		if connector == nil {
			sleepWithContext(ctx, reconnectInterval)
			continue
		}

		appID := strings.TrimSpace(connector.AppID)
		appSecret := strings.TrimSpace(connector.AppSecret)
		if appID == "" || appSecret == "" {
			log.Println("[FeishuWS] Waiting for app_id/app_secret before connecting")
			sleepWithContext(ctx, reconnectInterval)
			continue
		}

		targetURL, err := buildFeishuWSURL(wsURL, appID, appSecret)
		if err != nil {
			log.Printf("[FeishuWS] Invalid FEISHU_WS_URL: %v", err)
			sleepWithContext(ctx, reconnectInterval)
			continue
		}

		conn, _, err := websocket.DefaultDialer.DialContext(ctx, targetURL, nil)
		if err != nil {
			log.Printf("[FeishuWS] Connect failed: %v", err)
			sleepWithContext(ctx, reconnectInterval)
			continue
		}

		log.Printf("[FeishuWS] Connected to %s", targetURL)
		_ = h.repo.AppendFeishuIntegrationLog(ctx, connector.ID, "info", "ws_connected", "Feishu WS long connection established")

		err = h.consumeFeishuWS(ctx, conn)
		_ = conn.Close()
		if err != nil && !isWSNormalClose(err) {
			log.Printf("[FeishuWS] Connection closed with error: %v", err)
		}
		_ = h.repo.AppendFeishuIntegrationLog(ctx, connector.ID, "info", "ws_disconnected", "Feishu WS long connection disconnected")
		sleepWithContext(ctx, reconnectInterval)
	}
}

func (h *Handler) consumeFeishuWS(ctx context.Context, conn *websocket.Conn) error {
	for {
		select {
		case <-ctx.Done():
			return nil
		default:
		}

		_ = conn.SetReadDeadline(time.Now().Add(feishuWSReadTimeout))
		_, raw, err := conn.ReadMessage()
		if err != nil {
			return err
		}
		if len(raw) == 0 {
			continue
		}

		payload, ackID := unwrapFeishuWSMessage(raw)
		if ackID != "" {
			_ = conn.WriteJSON(map[string]any{"id": ackID, "uuid": ackID})
		}
		if payload == nil {
			continue
		}

		rawPayload, err := json.Marshal(payload)
		if err != nil {
			rawPayload = raw
		}
		if err := h.processFeishuWSInbound(ctx, payload, rawPayload); err != nil {
			log.Printf("[FeishuWS] Inbound processing error: %v", err)
		}
	}
}

func (h *Handler) processFeishuWSInbound(ctx context.Context, payload map[string]any, rawBody []byte) error {
	connector, err := h.repo.GetFeishuConnector(ctx)
	if err != nil || connector == nil {
		return err
	}

	if !verifyFeishuWSToken(payload, connector.VerificationToken) {
		_ = h.repo.AppendFeishuIntegrationLog(ctx, connector.ID, "error", "ws_auth", "Rejected WS event due to invalid token")
		return nil
	}

	// Keep long connection alive even when connector is disabled,
	// but do not route any inbound events into Butler in this state.
	if !connector.Enabled {
		return nil
	}

	inbound := parseFeishuInbound(payload)
	if inbound.MessageID == "" {
		return nil
	}

	registered, err := h.repo.RegisterFeishuInboundMessage(
		ctx,
		connector.ID,
		inbound.MessageID,
		inbound.ChatID,
		inbound.FeishuUserID,
		string(rawBody),
	)
	if err != nil {
		return err
	}
	if !registered {
		return nil
	}

	allowed, reason := allowFeishuInbound(connector, inbound)
	if !allowed {
		_ = h.repo.AppendFeishuIntegrationLog(ctx, connector.ID, "info", "ws_filtered", reason)
		return nil
	}

	text := normalizeFeishuText(inbound.TextContent)
	if text == "" {
		_ = h.repo.AppendFeishuIntegrationLog(ctx, connector.ID, "info", "ws_filtered", "empty_text")
		return nil
	}

	if prefix := strings.TrimSpace(connector.PrefixCommand); prefix != "" {
		if !strings.HasPrefix(text, prefix) {
			_ = h.repo.AppendFeishuIntegrationLog(ctx, connector.ID, "info", "ws_filtered", "prefix_not_matched")
			return nil
		}
		text = strings.TrimSpace(strings.TrimPrefix(text, prefix))
	}
	if text == "" {
		return nil
	}

	bridgeUserID, err := h.ensureFeishuBridgeUser(ctx, inbound.FeishuUserID)
	if err != nil {
		return err
	}

	if svc := butler.GetButler(); svc != nil {
		go svc.HandleUserMessage(context.Background(), bridgeUserID, text)
	}

	detail := "Accepted inbound WS message " + inbound.MessageID + " from feishu_user=" + inbound.FeishuUserID + " chat=" + inbound.ChatID
	_ = h.repo.AppendFeishuIntegrationLog(ctx, connector.ID, "success", "ws_routed", detail)
	return nil
}

func unwrapFeishuWSMessage(raw []byte) (map[string]any, string) {
	var envelope map[string]any
	if err := json.Unmarshal(raw, &envelope); err != nil {
		return nil, ""
	}

	ackID := firstNonEmptyString(
		stringFromMap(envelope, "uuid"),
		stringFromMap(envelope, "id"),
		stringFromMap(envelope, "message_id"),
		stringFromMap(mapFromPayload(envelope, "header"), "event_id"),
	)

	payloadRaw, ok := envelope["payload"]
	if !ok {
		if _, hasEvent := envelope["event"]; hasEvent {
			return envelope, ackID
		}
		return nil, ackID
	}

	switch v := payloadRaw.(type) {
	case map[string]any:
		return v, ackID
	case string:
		var payload map[string]any
		if err := json.Unmarshal([]byte(v), &payload); err == nil {
			return payload, ackID
		}
	}
	return nil, ackID
}

func buildFeishuWSURL(baseURL, appID, appSecret string) (string, error) {
	parsed, err := url.Parse(strings.TrimSpace(baseURL))
	if err != nil {
		return "", err
	}
	q := parsed.Query()
	if strings.TrimSpace(q.Get("app_id")) == "" {
		q.Set("app_id", strings.TrimSpace(appID))
	}
	if strings.TrimSpace(q.Get("app_secret")) == "" {
		q.Set("app_secret", strings.TrimSpace(appSecret))
	}
	parsed.RawQuery = q.Encode()
	return parsed.String(), nil
}

func sleepWithContext(ctx context.Context, d time.Duration) {
	timer := time.NewTimer(d)
	defer timer.Stop()
	select {
	case <-ctx.Done():
	case <-timer.C:
	}
}

func isWSNormalClose(err error) bool {
	return websocket.IsCloseError(err, websocket.CloseNormalClosure, websocket.CloseGoingAway)
}

func verifyFeishuWSToken(payload map[string]any, expected string) bool {
	expected = strings.TrimSpace(expected)
	if expected == "" {
		// Token verification is optional in long-connection mode.
		return true
	}

	token := strings.TrimSpace(extractFeishuToken(payload))
	if token == "" {
		return false
	}
	return token == expected
}
