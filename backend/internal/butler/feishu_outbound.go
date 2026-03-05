package butler

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strings"

	lark "github.com/larksuite/oapi-sdk-go/v3"
	larkim "github.com/larksuite/oapi-sdk-go/v3/service/im/v1"
	"github.com/lea/echocenter/backend/internal/models"
)

func (s *ButlerService) forwardButlerReplyToFeishu(ctx context.Context, receiverID int, content string) {
	if s == nil || s.repo == nil {
		return
	}
	if strings.TrimSpace(content) == "" {
		return
	}

	receiver, err := s.repo.GetUserByID(ctx, receiverID)
	if err != nil || receiver == nil || !strings.EqualFold(strings.TrimSpace(receiver.Role), "ADMIN") {
		return
	}

	connector, err := s.repo.GetFeishuConnector(ctx)
	if err != nil || connector == nil {
		return
	}
	if !connector.Enabled && !connector.CallbackVerified {
		return
	}
	appID := strings.TrimSpace(connector.AppID)
	appSecret := strings.TrimSpace(connector.AppSecret)
	if appID == "" || appSecret == "" {
		_ = s.repo.AppendFeishuIntegrationLog(ctx, connector.ID, "error", "ws_outbound", "Skipped outbound: app_id/app_secret missing")
		return
	}

	receiveIDType, receiveID := s.resolveFeishuReceiveTarget(ctx, connector)

	if receiveID == "" {
		_ = s.repo.AppendFeishuIntegrationLog(ctx, connector.ID, "info", "ws_outbound", "Skipped outbound: no target chat_id")
		return
	}

	client := lark.NewClient(appID, appSecret)
	contentJSON, _ := json.Marshal(map[string]string{"text": content})
	req := larkim.NewCreateMessageReqBuilder().
		ReceiveIdType(receiveIDType).
		Body(larkim.NewCreateMessageReqBodyBuilder().
			ReceiveId(receiveID).
			MsgType("text").
			Content(string(contentJSON)).
			Build()).
		Build()

	resp, err := client.Im.Message.Create(ctx, req)
	if err != nil {
		log.Printf("[FeishuWS] Outbound send failed: %v", err)
		_ = s.repo.AppendFeishuIntegrationLog(ctx, connector.ID, "error", "ws_outbound", "Send failed: "+err.Error())
		return
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
		detail := fmt.Sprintf("Send failed: code=%d msg=%s", code, msg)
		log.Printf("[FeishuWS] Outbound send failed: %s", detail)
		_ = s.repo.AppendFeishuIntegrationLog(ctx, connector.ID, "error", "ws_outbound", detail)
		return
	}

	_ = s.repo.AppendFeishuIntegrationLog(ctx, connector.ID, "success", "ws_outbound", "Sent Butler reply to Feishu target "+receiveID)
}

func (s *ButlerService) forwardAuthRequestToFeishu(
	ctx context.Context,
	receiverID int,
	actionID string,
	targetAgentName string,
	command string,
	reason string,
) {
	if s == nil || s.repo == nil {
		return
	}

	receiver, err := s.repo.GetUserByID(ctx, receiverID)
	if err != nil || receiver == nil || !strings.EqualFold(strings.TrimSpace(receiver.Role), "ADMIN") {
		return
	}

	connector, err := s.repo.GetFeishuConnector(ctx)
	if err != nil || connector == nil {
		return
	}
	if !connector.Enabled && !connector.CallbackVerified {
		return
	}

	appID := strings.TrimSpace(connector.AppID)
	appSecret := strings.TrimSpace(connector.AppSecret)
	if appID == "" || appSecret == "" {
		_ = s.repo.AppendFeishuIntegrationLog(ctx, connector.ID, "error", "ws_auth_card", "Skipped auth card: app_id/app_secret missing")
		return
	}

	receiveIDType, receiveID := s.resolveFeishuReceiveTarget(ctx, connector)
	if receiveID == "" {
		_ = s.repo.AppendFeishuIntegrationLog(ctx, connector.ID, "info", "ws_auth_card", "Skipped auth card: no target chat_id")
		return
	}

	card := buildFeishuAuthRequestCard(actionID, targetAgentName, command, reason)
	contentJSON, _ := json.Marshal(card)
	client := lark.NewClient(appID, appSecret)

	req := larkim.NewCreateMessageReqBuilder().
		ReceiveIdType(receiveIDType).
		Body(larkim.NewCreateMessageReqBodyBuilder().
			ReceiveId(receiveID).
			MsgType("interactive").
			Content(string(contentJSON)).
			Build()).
		Build()

	resp, err := client.Im.Message.Create(ctx, req)
	if err != nil {
		_ = s.repo.AppendFeishuIntegrationLog(ctx, connector.ID, "error", "ws_auth_card", "Send auth card failed: "+err.Error())
		return
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
		_ = s.repo.AppendFeishuIntegrationLog(ctx, connector.ID, "error", "ws_auth_card", fmt.Sprintf("Send auth card failed: code=%d msg=%s", code, msg))
		return
	}

	_ = s.repo.AppendFeishuIntegrationLog(ctx, connector.ID, "success", "ws_auth_card", "Sent auth request card action_id="+actionID)
}

func (s *ButlerService) resolveFeishuReceiveTarget(ctx context.Context, connector *models.FeishuConnector) (string, string) {
	if connector == nil {
		return larkim.ReceiveIdTypeChatId, ""
	}

	targetChatID := ""
	for _, candidate := range connector.AllowedChatIDs {
		candidate = strings.TrimSpace(candidate)
		if candidate != "" {
			targetChatID = candidate
			break
		}
	}

	targetFeishuUserID := ""
	if targetChatID == "" {
		latestChatID, latestUserID, err := s.repo.GetLatestFeishuInboundTarget(ctx, connector.ID)
		if err != nil {
			log.Printf("[FeishuWS] Failed to load latest inbound target: %v", err)
		}
		targetChatID = strings.TrimSpace(latestChatID)
		targetFeishuUserID = strings.TrimSpace(latestUserID)
	}

	receiveIDType := larkim.ReceiveIdTypeChatId
	receiveID := targetChatID
	if receiveID == "" && targetFeishuUserID != "" {
		if strings.HasPrefix(targetFeishuUserID, "ou_") {
			receiveIDType = larkim.ReceiveIdTypeOpenId
		} else {
			receiveIDType = larkim.ReceiveIdTypeUserId
		}
		receiveID = targetFeishuUserID
	}

	return receiveIDType, receiveID
}

func buildFeishuAuthRequestCard(actionID, targetAgentName, command, reason string) map[string]any {
	return map[string]any{
		"config": map[string]any{
			"wide_screen_mode": true,
			"update_multi":     true,
		},
		"header": map[string]any{
			"template": "orange",
			"title": map[string]any{
				"tag":     "plain_text",
				"content": "授权请求",
			},
		},
		"elements": []any{
			map[string]any{
				"tag": "markdown",
				"content": fmt.Sprintf(
					"需要授权执行命令。\n- 目标: `%s`\n- 指令: `%s`\n- 原因: %s",
					strings.TrimSpace(targetAgentName),
					strings.TrimSpace(command),
					strings.TrimSpace(reason),
				),
			},
			map[string]any{
				"tag": "action",
				"actions": []any{
					map[string]any{
						"tag":  "button",
						"type": "primary",
						"text": map[string]any{
							"tag":     "plain_text",
							"content": "批准",
						},
						"value": map[string]any{
							"action":    "feishu_auth_decision",
							"action_id": actionID,
							"approved":  "true",
						},
					},
					map[string]any{
						"tag":  "button",
						"type": "danger",
						"text": map[string]any{
							"tag":     "plain_text",
							"content": "拒绝",
						},
						"value": map[string]any{
							"action":    "feishu_auth_decision",
							"action_id": actionID,
							"approved":  "false",
						},
					},
				},
			},
		},
	}
}
