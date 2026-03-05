package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/url"
	"strings"
	"time"

	larkdispatcher "github.com/larksuite/oapi-sdk-go/v3/event/dispatcher"
	larkim "github.com/larksuite/oapi-sdk-go/v3/service/im/v1"
	larkws "github.com/larksuite/oapi-sdk-go/v3/ws"
	"github.com/lea/echocenter/backend/internal/butler"
)

type feishuWSRuntime struct {
	key    string
	cancel context.CancelFunc
	done   chan struct{}
}

// StartFeishuWebSocketBridge starts Feishu long-connection consumption by using official SDK.
// It is best-effort and never returns an error to caller.
func (h *Handler) StartFeishuWebSocketBridge(ctx context.Context, wsURL string, reconnectInterval time.Duration) {
	if reconnectInterval <= 0 {
		reconnectInterval = 5 * time.Second
	}
	domain := feishuDomainFromWSURL(wsURL)
	log.Printf("[FeishuWS] SDK bridge started (domain=%s check_interval=%s)", domain, reconnectInterval)

	var runtime *feishuWSRuntime
	stopRuntime := func(reason string) {
		if runtime == nil {
			return
		}
		if reason != "" {
			log.Printf("[FeishuWS] Stopping active client: %s", reason)
		}
		runtime.cancel()
		runtime = nil
	}

	for {
		select {
		case <-ctx.Done():
			stopRuntime("context canceled")
			log.Println("[FeishuWS] SDK bridge stopped")
			return
		default:
		}

		if runtime != nil && isClosed(runtime.done) {
			runtime = nil
		}

		connector, err := h.repo.GetFeishuConnector(ctx)
		if err != nil {
			log.Printf("[FeishuWS] Failed to load connector: %v", err)
			sleepWithContext(ctx, reconnectInterval)
			continue
		}

		if connector == nil {
			stopRuntime("connector missing")
			sleepWithContext(ctx, reconnectInterval)
			continue
		}

		appID := strings.TrimSpace(connector.AppID)
		appSecret := strings.TrimSpace(connector.AppSecret)
		if appID == "" || appSecret == "" {
			stopRuntime("waiting for app_id/app_secret")
			sleepWithContext(ctx, reconnectInterval)
			continue
		}

		runtimeKey := fmt.Sprintf("%d|%s|%s|%s|%s|%s",
			connector.ID,
			appID,
			appSecret,
			strings.TrimSpace(connector.VerificationToken),
			strings.TrimSpace(connector.EncryptKey),
			domain,
		)

		if runtime != nil && runtime.key == runtimeKey {
			sleepWithContext(ctx, reconnectInterval)
			continue
		}

		stopRuntime("configuration changed")
		clientCtx, cancel := context.WithCancel(ctx)
		done := make(chan struct{})
		runtime = &feishuWSRuntime{
			key:    runtimeKey,
			cancel: cancel,
			done:   done,
		}

		go func(connectorID int, appID, appSecret, verificationToken, encryptKey string) {
			defer close(done)
			h.runFeishuWSClient(clientCtx, connectorID, appID, appSecret, verificationToken, encryptKey, domain)
		}(connector.ID, appID, appSecret, connector.VerificationToken, connector.EncryptKey)

		sleepWithContext(ctx, reconnectInterval)
	}
}

func (h *Handler) runFeishuWSClient(
	ctx context.Context,
	connectorID int,
	appID, appSecret, verificationToken, encryptKey, domain string,
) {
	dispatcher := larkdispatcher.NewEventDispatcher(
		strings.TrimSpace(verificationToken),
		strings.TrimSpace(encryptKey),
	)
	dispatcher.OnP2MessageReceiveV1(func(eventCtx context.Context, event *larkim.P2MessageReceiveV1) error {
		return h.processFeishuWSMessageEvent(eventCtx, event)
	})

	client := larkws.NewClient(
		strings.TrimSpace(appID),
		strings.TrimSpace(appSecret),
		larkws.WithDomain(domain),
		larkws.WithAutoReconnect(true),
		larkws.WithEventHandler(dispatcher),
	)

	_ = h.repo.AppendFeishuIntegrationLog(ctx, connectorID, "info", "ws_connecting", "Feishu WS SDK client starting")
	err := client.Start(ctx)
	if err != nil && ctx.Err() == nil {
		log.Printf("[FeishuWS] SDK client exited with error: %v", err)
		_ = h.repo.AppendFeishuIntegrationLog(ctx, connectorID, "error", "ws_client_error", err.Error())
		return
	}
	_ = h.repo.AppendFeishuIntegrationLog(ctx, connectorID, "info", "ws_disconnected", "Feishu WS SDK client stopped")
}

func (h *Handler) processFeishuWSMessageEvent(ctx context.Context, event *larkim.P2MessageReceiveV1) error {
	if event == nil {
		return nil
	}

	rawPayload, err := json.Marshal(event)
	if err != nil {
		return err
	}
	payload := map[string]any{}
	if err := json.Unmarshal(rawPayload, &payload); err != nil {
		return err
	}
	return h.processFeishuWSInbound(ctx, payload, rawPayload)
}

func (h *Handler) processFeishuWSInbound(ctx context.Context, payload map[string]any, rawBody []byte) error {
	connector, err := h.repo.GetFeishuConnector(ctx)
	if err != nil || connector == nil {
		return err
	}

	if hasFeishuWSToken(payload) && !verifyFeishuWSToken(payload, connector.VerificationToken) {
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

func sleepWithContext(ctx context.Context, d time.Duration) {
	timer := time.NewTimer(d)
	defer timer.Stop()
	select {
	case <-ctx.Done():
	case <-timer.C:
	}
}

func feishuDomainFromWSURL(rawURL string) string {
	trimmed := strings.TrimSpace(rawURL)
	if trimmed == "" {
		return "https://open.feishu.cn"
	}
	parsed, err := url.Parse(trimmed)
	if err != nil {
		return "https://open.feishu.cn"
	}
	host := strings.TrimSpace(parsed.Host)
	if host == "" {
		return "https://open.feishu.cn"
	}
	return "https://" + host
}

func hasFeishuWSToken(payload map[string]any) bool {
	got := strings.TrimSpace(extractFeishuToken(payload))
	return got != ""
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

func isClosed(ch <-chan struct{}) bool {
	select {
	case <-ch:
		return true
	default:
		return false
	}
}
