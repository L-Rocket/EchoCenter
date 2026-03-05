package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/url"
	"strings"
	"time"

	lark "github.com/larksuite/oapi-sdk-go/v3"
	larkdispatcher "github.com/larksuite/oapi-sdk-go/v3/event/dispatcher"
	larkcallback "github.com/larksuite/oapi-sdk-go/v3/event/dispatcher/callback"
	larkim "github.com/larksuite/oapi-sdk-go/v3/service/im/v1"
	larkws "github.com/larksuite/oapi-sdk-go/v3/ws"
	"github.com/lea/echocenter/backend/internal/butler"
	"github.com/lea/echocenter/backend/internal/models"
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
	}).OnP2CardActionTrigger(func(eventCtx context.Context, event *larkcallback.CardActionTriggerEvent) (*larkcallback.CardActionTriggerResponse, error) {
		return h.processFeishuWSCardAction(eventCtx, event)
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

	if isFeishuVerificationFormTrigger(text) {
		if err := h.sendFeishuVerificationFormCard(ctx, connector, inbound.ChatID, ""); err != nil {
			_ = h.repo.AppendFeishuIntegrationLog(ctx, connector.ID, "error", "ws_card_form", "Failed to send verification card: "+err.Error())
			return err
		}
		_ = h.repo.AppendFeishuIntegrationLog(ctx, connector.ID, "success", "ws_card_form", "Sent verification card to chat "+inbound.ChatID)
		return nil
	}

	bridgeUserID, err := h.ensureFeishuBridgeUser(ctx, inbound.FeishuUserID)
	if err != nil {
		return err
	}

	if err := h.routeFeishuInboundToButler(ctx, bridgeUserID, text); err != nil {
		return err
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

func isFeishuVerificationFormTrigger(text string) bool {
	normalized := strings.ToLower(strings.TrimSpace(text))
	if normalized == "" {
		return false
	}
	if strings.Contains(normalized, "/feishu-verify") || strings.Contains(normalized, "验证表单") {
		return true
	}
	return false
}

func (h *Handler) sendFeishuVerificationFormCard(ctx context.Context, connector *models.FeishuConnector, chatID string, statusText string) error {
	if connector == nil {
		return fmt.Errorf("connector not found")
	}

	appID := strings.TrimSpace(connector.AppID)
	appSecret := strings.TrimSpace(connector.AppSecret)
	if appID == "" || appSecret == "" {
		return fmt.Errorf("app_id/app_secret missing")
	}
	chatID = strings.TrimSpace(chatID)
	if chatID == "" {
		return fmt.Errorf("chat_id missing")
	}

	client := lark.NewClient(appID, appSecret)
	card := buildFeishuVerificationCard(statusText, connector.ID)
	content, _ := json.Marshal(card)

	req := larkim.NewCreateMessageReqBuilder().
		ReceiveIdType(larkim.ReceiveIdTypeChatId).
		Body(larkim.NewCreateMessageReqBodyBuilder().
			ReceiveId(chatID).
			MsgType("interactive").
			Content(string(content)).
			Build()).
		Build()

	resp, err := client.Im.Message.Create(ctx, req)
	if err != nil {
		return err
	}
	if resp == nil || !resp.Success() {
		code := -1
		msg := "unknown"
		if resp != nil {
			code = resp.Code
			msg = strings.TrimSpace(resp.Msg)
			if msg == "" {
				msg = "unknown"
			}
		}
		return fmt.Errorf("send card failed: code=%d msg=%s", code, msg)
	}
	return nil
}

func buildFeishuVerificationCard(statusText string, connectorID int) map[string]any {
	elements := []any{
		map[string]any{
			"tag":     "markdown",
			"content": "请填写飞书应用凭据并提交验证。提交后后端会向飞书鉴权接口发起真实校验。",
		},
	}
	statusText = strings.TrimSpace(statusText)
	if statusText != "" {
		elements = append(elements, map[string]any{
			"tag":     "markdown",
			"content": "**最近结果**: " + statusText,
		})
	}
	elements = append(elements,
		map[string]any{
			"tag":   "input",
			"name":  "app_id",
			"label": map[string]any{"tag": "plain_text", "content": "App ID"},
			"placeholder": map[string]any{
				"tag":     "plain_text",
				"content": "cli_xxx",
			},
		},
		map[string]any{
			"tag":   "input",
			"name":  "app_secret",
			"label": map[string]any{"tag": "plain_text", "content": "App Secret"},
			"placeholder": map[string]any{
				"tag":     "plain_text",
				"content": "请粘贴 app secret",
			},
		},
		map[string]any{
			"tag": "action",
			"actions": []any{
				map[string]any{
					"tag":  "button",
					"type": "primary",
					"text": map[string]any{
						"tag":     "plain_text",
						"content": "提交验证",
					},
					"value": map[string]any{
						"action":       "feishu_verify_submit",
						"connector_id": fmt.Sprintf("%d", connectorID),
					},
				},
			},
		},
	)

	return map[string]any{
		"config": map[string]any{
			"wide_screen_mode": true,
			"update_multi":     true,
		},
		"header": map[string]any{
			"template": "blue",
			"title": map[string]any{
				"tag":     "plain_text",
				"content": "EchoCenter 飞书连接验证",
			},
		},
		"elements": elements,
	}
}

func (h *Handler) processFeishuWSCardAction(ctx context.Context, event *larkcallback.CardActionTriggerEvent) (*larkcallback.CardActionTriggerResponse, error) {
	if event == nil || event.Event == nil || event.Event.Action == nil {
		return &larkcallback.CardActionTriggerResponse{
			Toast: &larkcallback.Toast{Type: "error", Content: "无效的卡片提交"},
		}, nil
	}

	action := strings.TrimSpace(stringFromAny(event.Event.Action.Value["action"]))
	switch action {
	case "feishu_verify_submit":
		return h.handleFeishuVerifyCardSubmit(ctx, event)
	case "feishu_auth_decision":
		return h.handleFeishuAuthDecisionCard(ctx, event)
	default:
		return &larkcallback.CardActionTriggerResponse{
			Toast: &larkcallback.Toast{Type: "info", Content: "未识别的卡片动作"},
		}, nil
	}
}

func (h *Handler) handleFeishuVerifyCardSubmit(ctx context.Context, event *larkcallback.CardActionTriggerEvent) (*larkcallback.CardActionTriggerResponse, error) {
	if event == nil || event.Event == nil || event.Event.Action == nil {
		return &larkcallback.CardActionTriggerResponse{
			Toast: &larkcallback.Toast{Type: "error", Content: "无效的卡片提交"},
		}, nil
	}

	connector, err := h.repo.GetFeishuConnector(ctx)
	if err != nil || connector == nil {
		return &larkcallback.CardActionTriggerResponse{
			Toast: &larkcallback.Toast{Type: "error", Content: "连接器不存在"},
		}, nil
	}

	form := event.Event.Action.FormValue
	appID := strings.TrimSpace(stringFromAny(form["app_id"]))
	appSecret := strings.TrimSpace(stringFromAny(form["app_secret"]))
	if appID == "" || appSecret == "" {
		msg := "app_id 和 app_secret 不能为空"
		return &larkcallback.CardActionTriggerResponse{
			Toast: &larkcallback.Toast{Type: "error", Content: msg},
			Card:  &larkcallback.Card{Type: "raw", Data: buildFeishuVerificationCard(msg, connector.ID)},
		}, nil
	}

	updated := *connector
	updated.AppID = appID
	updated.AppSecret = appSecret
	if err := h.repo.UpdateFeishuConnector(ctx, &updated); err != nil {
		msg := "保存凭据失败"
		return &larkcallback.CardActionTriggerResponse{
			Toast: &larkcallback.Toast{Type: "error", Content: msg},
			Card:  &larkcallback.Card{Type: "raw", Data: buildFeishuVerificationCard(msg, connector.ID)},
		}, nil
	}

	ok, detail, verifyErr := verifyFeishuAppCredentials(ctx, appID, appSecret)
	if verifyErr != nil {
		msg := "飞书鉴权请求失败: " + verifyErr.Error()
		_ = h.repo.AppendFeishuIntegrationLog(ctx, connector.ID, "error", "ws_card_verify", msg)
		return &larkcallback.CardActionTriggerResponse{
			Toast: &larkcallback.Toast{Type: "error", Content: "验证失败，请稍后重试"},
			Card:  &larkcallback.Card{Type: "raw", Data: buildFeishuVerificationCard(msg, connector.ID)},
		}, nil
	}
	if !ok {
		msg := "飞书拒绝凭据: " + detail
		_ = h.repo.AppendFeishuIntegrationLog(ctx, connector.ID, "error", "ws_card_verify", msg)
		return &larkcallback.CardActionTriggerResponse{
			Toast: &larkcallback.Toast{Type: "error", Content: "验证未通过"},
			Card:  &larkcallback.Card{Type: "raw", Data: buildFeishuVerificationCard(msg, connector.ID)},
		}, nil
	}

	verifiedAt := time.Now().UTC()
	if _, err := h.repo.MarkFeishuConnectorVerified(ctx, connector.ID, verifiedAt); err != nil {
		msg := "标记验证状态失败"
		return &larkcallback.CardActionTriggerResponse{
			Toast: &larkcallback.Toast{Type: "error", Content: msg},
			Card:  &larkcallback.Card{Type: "raw", Data: buildFeishuVerificationCard(msg, connector.ID)},
		}, nil
	}
	_ = h.repo.AppendFeishuIntegrationLog(ctx, connector.ID, "success", "ws_card_verify", "Feishu card verification succeeded")

	successCard := map[string]any{
		"config": map[string]any{
			"wide_screen_mode": true,
		},
		"header": map[string]any{
			"template": "green",
			"title": map[string]any{
				"tag":     "plain_text",
				"content": "验证成功",
			},
		},
		"elements": []any{
			map[string]any{
				"tag":     "markdown",
				"content": "飞书连接验证成功，Butler 现在可以正常接入消息。",
			},
		},
	}

	return &larkcallback.CardActionTriggerResponse{
		Toast: &larkcallback.Toast{Type: "success", Content: "飞书验证成功"},
		Card:  &larkcallback.Card{Type: "raw", Data: successCard},
	}, nil
}

func (h *Handler) handleFeishuAuthDecisionCard(ctx context.Context, event *larkcallback.CardActionTriggerEvent) (*larkcallback.CardActionTriggerResponse, error) {
	if event == nil || event.Event == nil || event.Event.Action == nil {
		return &larkcallback.CardActionTriggerResponse{
			Toast: &larkcallback.Toast{Type: "error", Content: "无效的授权提交"},
		}, nil
	}

	actionID := strings.TrimSpace(stringFromAny(event.Event.Action.Value["action_id"]))
	approvedRaw := strings.ToLower(strings.TrimSpace(stringFromAny(event.Event.Action.Value["approved"])))
	approved := approvedRaw == "true" || approvedRaw == "1" || approvedRaw == "yes"
	if actionID == "" {
		return &larkcallback.CardActionTriggerResponse{
			Toast: &larkcallback.Toast{Type: "error", Content: "缺少 action_id"},
		}, nil
	}

	svc := butler.GetButler()
	if svc == nil {
		return &larkcallback.CardActionTriggerResponse{
			Toast: &larkcallback.Toast{Type: "error", Content: "Butler 未初始化"},
		}, nil
	}

	adminID, err := h.ensureFeishuBridgeUser(ctx, "")
	if err != nil {
		return &larkcallback.CardActionTriggerResponse{
			Toast: &larkcallback.Toast{Type: "error", Content: "管理员身份解析失败"},
		}, nil
	}
	go svc.ExecutePendingCommand(context.Background(), actionID, adminID, approved)

	toast := "已拒绝执行"
	if approved {
		toast = "已批准，开始执行"
	}
	decision := "rejected"
	if approved {
		decision = "approved"
	}
	if connector, err := h.repo.GetFeishuConnector(ctx); err == nil && connector != nil {
		_ = h.repo.AppendFeishuIntegrationLog(ctx, connector.ID, "success", "ws_auth_card_decision", fmt.Sprintf("action_id=%s decision=%s", actionID, decision))
	}

	// NOTE: For card.action.trigger callbacks, returning toast-only is the most robust shape.
	// Some Feishu tenants reject card update payloads with 200340 when schema mismatches.
	return &larkcallback.CardActionTriggerResponse{
		Toast: &larkcallback.Toast{Type: "success", Content: toast},
	}, nil
}

func stringFromAny(v any) string {
	switch x := v.(type) {
	case string:
		return x
	case fmt.Stringer:
		return x.String()
	default:
		return ""
	}
}
