package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/lea/echocenter/backend/internal/butler"
	"github.com/lea/echocenter/backend/internal/models"
	apperrors "github.com/lea/echocenter/backend/pkg/errors"
)

func (h *Handler) GetFeishuConnector(c *gin.Context) {
	connector, err := h.repo.GetFeishuConnector(c.Request.Context())
	if err != nil {
		h.respondWithError(c, http.StatusInternalServerError, err)
		return
	}
	if connector == nil {
		c.JSON(http.StatusOK, defaultFeishuConnectorResponse())
		return
	}
	c.JSON(http.StatusOK, sanitizeFeishuConnectorResponse(*connector))
}

func (h *Handler) CreateFeishuConnector(c *gin.Context) {
	payload := make(map[string]any)
	if err := c.ShouldBindJSON(&payload); err != nil {
		h.respondWithError(c, http.StatusBadRequest, apperrors.Wrap(apperrors.ErrInvalidInput, "invalid request body", err))
		return
	}

	connector := defaultFeishuConnector()
	if err := applyFeishuPayload(&connector, payload); err != nil {
		h.respondWithError(c, http.StatusBadRequest, err)
		return
	}
	enforceFeishuServerManagedDefaults(&connector)

	if err := h.repo.CreateFeishuConnector(c.Request.Context(), &connector); err != nil {
		h.respondWithError(c, http.StatusInternalServerError, err)
		return
	}

	_ = h.repo.AppendFeishuIntegrationLog(c.Request.Context(), connector.ID, "success", "create_connector", "Feishu connector created")
	c.JSON(http.StatusCreated, sanitizeFeishuConnectorResponse(connector))
}

func (h *Handler) UpdateFeishuConnector(c *gin.Context) {
	id, err := strconv.Atoi(strings.TrimSpace(c.Param("id")))
	if err != nil || id <= 0 {
		h.respondWithError(c, http.StatusBadRequest, apperrors.New(apperrors.ErrInvalidInput, "invalid connector id"))
		return
	}

	existing, err := h.repo.GetFeishuConnector(c.Request.Context())
	if err != nil {
		h.respondWithError(c, http.StatusInternalServerError, err)
		return
	}
	if existing == nil || existing.ID != id {
		h.respondWithError(c, http.StatusNotFound, apperrors.New(apperrors.ErrNotFound, "feishu connector not found"))
		return
	}

	payload := make(map[string]any)
	if err := c.ShouldBindJSON(&payload); err != nil {
		h.respondWithError(c, http.StatusBadRequest, apperrors.Wrap(apperrors.ErrInvalidInput, "invalid request body", err))
		return
	}

	updated := *existing
	if err := applyFeishuPayload(&updated, payload); err != nil {
		h.respondWithError(c, http.StatusBadRequest, err)
		return
	}
	copyFeishuServerManagedFields(&updated, *existing)
	if shouldInvalidateFeishuVerification(*existing, updated) {
		invalidateFeishuVerification(&updated)
		_ = h.repo.AppendFeishuIntegrationLog(c.Request.Context(), id, "info", "callback_verification_reset", "Callback verification reset due to callback auth config change")
	}
	updated.ID = id

	if err := h.repo.UpdateFeishuConnector(c.Request.Context(), &updated); err != nil {
		h.respondWithError(c, http.StatusInternalServerError, err)
		return
	}

	_ = h.repo.AppendFeishuIntegrationLog(c.Request.Context(), updated.ID, "info", "update_connector", "Feishu connector updated")
	c.JSON(http.StatusOK, sanitizeFeishuConnectorResponse(updated))
}

func (h *Handler) VerifyFeishuCallback(c *gin.Context) {
	id, err := strconv.Atoi(strings.TrimSpace(c.Param("id")))
	if err != nil || id <= 0 {
		h.respondWithError(c, http.StatusBadRequest, apperrors.New(apperrors.ErrInvalidInput, "invalid connector id"))
		return
	}

	connector, err := h.repo.GetFeishuConnector(c.Request.Context())
	if err != nil {
		h.respondWithError(c, http.StatusInternalServerError, err)
		return
	}
	if connector == nil || connector.ID != id {
		h.respondWithError(c, http.StatusNotFound, apperrors.New(apperrors.ErrNotFound, "feishu connector not found"))
		return
	}

	if strings.TrimSpace(connector.AppID) == "" || strings.TrimSpace(connector.AppSecret) == "" {
		_ = h.repo.AppendFeishuIntegrationLog(c.Request.Context(), id, "error", "verify_callback", "Missing app_id or app_secret")
		c.JSON(http.StatusOK, gin.H{
			"ok":      false,
			"message": "app_id and app_secret are required before verification",
		})
		return
	}

	verifiedAt := time.Now().UTC()
	connector, err = h.repo.MarkFeishuConnectorVerified(c.Request.Context(), id, verifiedAt)
	if err != nil {
		h.respondWithError(c, http.StatusInternalServerError, err)
		return
	}
	_ = h.repo.AppendFeishuIntegrationLog(c.Request.Context(), id, "success", "verify_callback", "Callback verification succeeded")

	// After successful verification, ask Butler to send a short greeting.
	if svc := butler.GetButler(); svc != nil {
		if adminID, lookupErr := h.ensureFeishuBridgeUser(c.Request.Context(), ""); lookupErr == nil {
			go svc.HandleUserMessage(context.Background(), adminID, "请用一句话确认飞书连接验证成功，并向管理员打个招呼。")
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"ok":          true,
		"message":     "callback verified",
		"verified_at": verifiedAt.Format(time.RFC3339Nano),
		"connector":   sanitizeFeishuConnectorResponse(*connector),
	})
}

func (h *Handler) SendFeishuTestMessage(c *gin.Context) {
	id, err := strconv.Atoi(strings.TrimSpace(c.Param("id")))
	if err != nil || id <= 0 {
		h.respondWithError(c, http.StatusBadRequest, apperrors.New(apperrors.ErrInvalidInput, "invalid connector id"))
		return
	}

	connector, err := h.repo.GetFeishuConnector(c.Request.Context())
	if err != nil {
		h.respondWithError(c, http.StatusInternalServerError, err)
		return
	}
	if connector == nil || connector.ID != id {
		h.respondWithError(c, http.StatusNotFound, apperrors.New(apperrors.ErrNotFound, "feishu connector not found"))
		return
	}

	var req struct {
		TargetChatID string `json:"target_chat_id"`
		Text         string `json:"text"`
	}
	_ = c.ShouldBindJSON(&req)

	if strings.TrimSpace(connector.AppID) == "" || strings.TrimSpace(connector.AppSecret) == "" {
		_ = h.repo.AppendFeishuIntegrationLog(c.Request.Context(), id, "error", "test_message", "Missing app_id or app_secret")
		c.JSON(http.StatusOK, gin.H{
			"ok":      false,
			"message": "app_id and app_secret are required",
		})
		return
	}

	traceID := fmt.Sprintf("feishu-test-%d", time.Now().UnixNano())
	target := strings.TrimSpace(req.TargetChatID)
	if target == "" {
		target = "connector-default-route"
	}
	text := strings.TrimSpace(req.Text)
	if text == "" {
		text = "EchoCenter Feishu connector test message"
	}

	detail := fmt.Sprintf("Test message accepted (target=%s trace=%s text=%s)", target, traceID, text)
	_ = h.repo.AppendFeishuIntegrationLog(c.Request.Context(), id, "info", "test_message", detail)
	c.JSON(http.StatusOK, gin.H{
		"ok":       true,
		"message":  "test message accepted",
		"trace_id": traceID,
	})
}

func (h *Handler) SetFeishuConnectorEnabled(c *gin.Context) {
	id, err := strconv.Atoi(strings.TrimSpace(c.Param("id")))
	if err != nil || id <= 0 {
		h.respondWithError(c, http.StatusBadRequest, apperrors.New(apperrors.ErrInvalidInput, "invalid connector id"))
		return
	}

	var req struct {
		Enabled bool `json:"enabled"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		h.respondWithError(c, http.StatusBadRequest, apperrors.Wrap(apperrors.ErrInvalidInput, "invalid request body", err))
		return
	}

	connector, err := h.repo.GetFeishuConnector(c.Request.Context())
	if err != nil {
		h.respondWithError(c, http.StatusInternalServerError, err)
		return
	}
	if connector == nil || connector.ID != id {
		h.respondWithError(c, http.StatusNotFound, apperrors.New(apperrors.ErrNotFound, "feishu connector not found"))
		return
	}

	if req.Enabled && !connector.CallbackVerified {
		_ = h.repo.AppendFeishuIntegrationLog(c.Request.Context(), id, "error", "set_enabled", "Rejected enable because callback not verified")
		h.respondWithError(c, http.StatusBadRequest, apperrors.New(apperrors.ErrInvalidInput, "callback must be verified before enabling"))
		return
	}

	updated, err := h.repo.SetFeishuConnectorEnabled(c.Request.Context(), id, req.Enabled)
	if err != nil {
		h.respondWithError(c, http.StatusInternalServerError, err)
		return
	}

	action := "disable_connector"
	detail := "Feishu connector disabled"
	if req.Enabled {
		action = "enable_connector"
		detail = "Feishu connector enabled"
	}
	_ = h.repo.AppendFeishuIntegrationLog(c.Request.Context(), id, "success", action, detail)
	c.JSON(http.StatusOK, sanitizeFeishuConnectorResponse(*updated))
}

func (h *Handler) ListFeishuIntegrationLogs(c *gin.Context) {
	id, err := strconv.Atoi(strings.TrimSpace(c.Param("id")))
	if err != nil || id <= 0 {
		h.respondWithError(c, http.StatusBadRequest, apperrors.New(apperrors.ErrInvalidInput, "invalid connector id"))
		return
	}

	limit := 20
	if raw := strings.TrimSpace(c.Query("limit")); raw != "" {
		parsed, convErr := strconv.Atoi(raw)
		if convErr != nil || parsed <= 0 {
			h.respondWithError(c, http.StatusBadRequest, apperrors.New(apperrors.ErrInvalidInput, "invalid limit"))
			return
		}
		limit = parsed
	}

	logs, cursor, err := h.repo.ListFeishuIntegrationLogs(c.Request.Context(), id, strings.TrimSpace(c.Query("cursor")), limit)
	if err != nil {
		h.respondWithError(c, http.StatusInternalServerError, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"items":  logs,
		"cursor": cursor,
	})
}

func (h *Handler) HandleFeishuCallback(c *gin.Context) {
	rawBody, err := c.GetRawData()
	if err != nil {
		h.respondWithError(c, http.StatusBadRequest, apperrors.Wrap(apperrors.ErrInvalidInput, "failed to read callback body", err))
		return
	}

	var payload map[string]any
	if err := json.Unmarshal(rawBody, &payload); err != nil {
		h.respondWithError(c, http.StatusBadRequest, apperrors.Wrap(apperrors.ErrInvalidInput, "invalid callback payload", err))
		return
	}

	connector, err := h.repo.GetFeishuConnector(c.Request.Context())
	if err != nil {
		h.respondWithError(c, http.StatusInternalServerError, err)
		return
	}
	if connector == nil {
		c.JSON(http.StatusAccepted, gin.H{"status": "ignored", "reason": "connector_not_configured"})
		return
	}

	if challenge, ok := stringFromPayload(payload, "challenge"); ok && challenge != "" {
		token, _ := stringFromPayload(payload, "token")
		if !h.verifyFeishuToken(token, connector.VerificationToken) {
			h.respondWithError(c, http.StatusUnauthorized, apperrors.New(apperrors.ErrUnauthorized, "invalid feishu token"))
			return
		}
		c.JSON(http.StatusOK, gin.H{"challenge": challenge})
		return
	}

	if !connector.Enabled {
		c.JSON(http.StatusAccepted, gin.H{"status": "ignored", "reason": "connector_disabled"})
		return
	}

	token := extractFeishuToken(payload)
	if !h.verifyFeishuToken(token, connector.VerificationToken) {
		_ = h.repo.AppendFeishuIntegrationLog(c.Request.Context(), connector.ID, "error", "callback_auth", "Rejected callback due to invalid token")
		h.respondWithError(c, http.StatusUnauthorized, apperrors.New(apperrors.ErrUnauthorized, "invalid feishu token"))
		return
	}

	inbound := parseFeishuInbound(payload)
	if inbound.MessageID == "" {
		c.JSON(http.StatusOK, gin.H{"status": "ignored", "reason": "no_message_id"})
		return
	}

	registered, err := h.repo.RegisterFeishuInboundMessage(
		c.Request.Context(),
		connector.ID,
		inbound.MessageID,
		inbound.ChatID,
		inbound.FeishuUserID,
		string(rawBody),
	)
	if err != nil {
		h.respondWithError(c, http.StatusInternalServerError, err)
		return
	}
	if !registered {
		c.JSON(http.StatusOK, gin.H{"status": "duplicate"})
		return
	}

	allowed, reason := allowFeishuInbound(connector, inbound)
	if !allowed {
		_ = h.repo.AppendFeishuIntegrationLog(c.Request.Context(), connector.ID, "info", "callback_filtered", reason)
		c.JSON(http.StatusOK, gin.H{"status": "ignored", "reason": reason})
		return
	}

	text := normalizeFeishuText(inbound.TextContent)
	if text == "" {
		_ = h.repo.AppendFeishuIntegrationLog(c.Request.Context(), connector.ID, "info", "callback_filtered", "empty_text")
		c.JSON(http.StatusOK, gin.H{"status": "ignored", "reason": "empty_text"})
		return
	}

	if prefix := strings.TrimSpace(connector.PrefixCommand); prefix != "" {
		if !strings.HasPrefix(text, prefix) {
			_ = h.repo.AppendFeishuIntegrationLog(c.Request.Context(), connector.ID, "info", "callback_filtered", "prefix_not_matched")
			c.JSON(http.StatusOK, gin.H{"status": "ignored", "reason": "prefix_not_matched"})
			return
		}
		text = strings.TrimSpace(strings.TrimPrefix(text, prefix))
	}
	if text == "" {
		c.JSON(http.StatusOK, gin.H{"status": "ignored", "reason": "empty_text"})
		return
	}

	bridgeUserID, err := h.ensureFeishuBridgeUser(c.Request.Context(), inbound.FeishuUserID)
	if err != nil {
		h.respondWithError(c, http.StatusInternalServerError, err)
		return
	}

	if err := h.routeFeishuInboundToButler(c.Request.Context(), bridgeUserID, text); err != nil {
		h.respondWithError(c, http.StatusInternalServerError, err)
		return
	}

	detail := fmt.Sprintf("Accepted inbound message %s from feishu_user=%s chat=%s", inbound.MessageID, inbound.FeishuUserID, inbound.ChatID)
	_ = h.repo.AppendFeishuIntegrationLog(c.Request.Context(), connector.ID, "success", "callback_routed", detail)
	c.JSON(http.StatusOK, gin.H{"status": "accepted"})
}

type feishuInboundMessage struct {
	MessageID    string
	ChatID       string
	FeishuUserID string
	ChatType     string
	SenderType   string
	TextContent  string
	Mentioned    bool
	IsGroup      bool
}

func parseFeishuInbound(payload map[string]any) feishuInboundMessage {
	msg := feishuInboundMessage{}
	event := mapFromPayload(payload, "event")
	header := mapFromPayload(payload, "header")
	message := mapFromPayload(event, "message")
	sender := mapFromPayload(event, "sender")
	senderID := mapFromPayload(sender, "sender_id")

	msg.MessageID = firstNonEmptyString(
		stringFromMap(message, "message_id"),
		stringFromMap(header, "event_id"),
	)
	msg.ChatID = stringFromMap(message, "chat_id")
	msg.ChatType = strings.ToLower(stringFromMap(message, "chat_type"))
	msg.SenderType = strings.ToLower(firstNonEmptyString(stringFromMap(sender, "sender_type"), stringFromMap(header, "sender_type")))
	msg.FeishuUserID = firstNonEmptyString(
		stringFromMap(senderID, "user_id"),
		stringFromMap(senderID, "open_id"),
		stringFromMap(senderID, "union_id"),
	)
	msg.TextContent = parseFeishuTextContent(stringFromMap(message, "content"))

	mentions := listFromMap(message, "mentions")
	msg.Mentioned = len(mentions) > 0
	msg.IsGroup = msg.ChatType == "group" || msg.ChatType == "chat" || msg.ChatType == "thread"
	return msg
}

func allowFeishuInbound(connector *models.FeishuConnector, inbound feishuInboundMessage) (bool, string) {
	if connector == nil {
		return false, "connector_missing"
	}
	if connector.IgnoreBotMessages && inbound.SenderType == "bot" {
		return false, "bot_message_ignored"
	}
	if inbound.IsGroup && !connector.AllowGroupMention {
		return false, "group_message_disabled"
	}
	if !inbound.IsGroup && !connector.AllowDM {
		return false, "dm_disabled"
	}
	if inbound.IsGroup && connector.MentionRequired && !inbound.Mentioned {
		return false, "mention_required"
	}
	if len(connector.AllowedChatIDs) > 0 && !containsValue(connector.AllowedChatIDs, inbound.ChatID) {
		return false, "chat_not_allowed"
	}
	if len(connector.UserWhitelist) > 0 && !containsValue(connector.UserWhitelist, inbound.FeishuUserID) {
		return false, "user_not_whitelisted"
	}
	return true, ""
}

func containsValue(values []string, target string) bool {
	if strings.TrimSpace(target) == "" {
		return false
	}
	for _, item := range values {
		if strings.EqualFold(strings.TrimSpace(item), strings.TrimSpace(target)) {
			return true
		}
	}
	return false
}

func parseFeishuTextContent(raw string) string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return ""
	}
	var obj map[string]any
	if err := json.Unmarshal([]byte(trimmed), &obj); err != nil {
		return trimmed
	}
	if v, ok := obj["text"].(string); ok {
		return v
	}
	return trimmed
}

func normalizeFeishuText(raw string) string {
	return strings.TrimSpace(strings.ReplaceAll(raw, "\u00a0", " "))
}

func extractFeishuToken(payload map[string]any) string {
	if token, ok := stringFromPayload(payload, "token"); ok && token != "" {
		return token
	}
	header := mapFromPayload(payload, "header")
	return stringFromMap(header, "token")
}

func (h *Handler) verifyFeishuToken(got, expected string) bool {
	expected = strings.TrimSpace(expected)
	if expected == "" {
		return false
	}
	return strings.TrimSpace(got) == expected
}

func (h *Handler) ensureFeishuBridgeUser(ctx context.Context, _ string) (int, error) {
	user, err := h.repo.GetUserByUsername(ctx, "admin")
	if err != nil {
		return 0, err
	}
	if user != nil && strings.EqualFold(strings.TrimSpace(user.Role), "ADMIN") {
		return user.ID, nil
	}

	users, err := h.repo.GetUsers(ctx)
	if err != nil {
		return 0, err
	}
	for i := range users {
		if strings.EqualFold(strings.TrimSpace(users[i].Role), "ADMIN") {
			return users[i].ID, nil
		}
	}

	return 0, apperrors.New(apperrors.ErrNotFound, "admin user not found")
}

func (h *Handler) routeFeishuInboundToButler(ctx context.Context, senderID int, payload string) error {
	payload = strings.TrimSpace(payload)
	if payload == "" {
		return nil
	}

	svc := butler.GetButler()
	if svc == nil {
		return apperrors.New(apperrors.ErrInternal, "butler service not initialized")
	}
	butlerID := svc.GetButlerID()
	if butlerID <= 0 {
		return apperrors.New(apperrors.ErrInternal, "invalid butler user id")
	}

	if h.hub != nil {
		h.hub.BroadcastGeneric(map[string]any{
			"type":        "CHAT",
			"sender_id":   senderID,
			"sender_name": "admin",
			"sender_role": "ADMIN",
			"target_id":   butlerID,
			"payload":     payload,
		})
		return nil
	}

	go svc.HandleUserMessage(context.Background(), senderID, payload)
	return nil
}

func defaultFeishuConnector() models.FeishuConnector {
	return models.FeishuConnector{
		ConnectorName:      "Feishu Butler Connector",
		Enabled:            false,
		Status:             "not_connected",
		AllowDM:            true,
		AllowGroupMention:  true,
		MentionRequired:    false,
		PrefixCommand:      "",
		IgnoreBotMessages:  true,
		RateLimitPerMinute: 30,
		AllowedChatIDs:     []string{},
		UserWhitelist:      []string{},
		CallbackVerified:   false,
	}
}

func defaultFeishuConnectorResponse() gin.H {
	base := defaultFeishuConnector()
	return sanitizeFeishuConnectorResponse(base)
}

func sanitizeFeishuConnectorResponse(connector models.FeishuConnector) gin.H {
	return gin.H{
		"id":                     connector.ID,
		"connector_name":         connector.ConnectorName,
		"enabled":                connector.Enabled,
		"status":                 connector.Status,
		"app_id":                 connector.AppID,
		"app_secret":             maskSecret(connector.AppSecret),
		"has_app_secret":         strings.TrimSpace(connector.AppSecret) != "",
		"verification_token":     maskSecret(connector.VerificationToken),
		"has_verification_token": strings.TrimSpace(connector.VerificationToken) != "",
		"encrypt_key":            maskSecret(connector.EncryptKey),
		"has_encrypt_key":        strings.TrimSpace(connector.EncryptKey) != "",
		"allow_dm":               connector.AllowDM,
		"allow_group_mention":    connector.AllowGroupMention,
		"mention_required":       connector.MentionRequired,
		"prefix_command":         connector.PrefixCommand,
		"ignore_bot_messages":    connector.IgnoreBotMessages,
		"rate_limit_per_minute":  connector.RateLimitPerMinute,
		"allowed_chat_ids":       connector.AllowedChatIDs,
		"user_whitelist":         connector.UserWhitelist,
		"callback_url":           connector.CallbackURL,
		"callback_verified":      connector.CallbackVerified,
		"last_verified_at":       connector.LastVerifiedAt,
		"created_at":             connector.CreatedAt,
		"updated_at":             connector.UpdatedAt,
	}
}

func maskSecret(secret string) string {
	secret = strings.TrimSpace(secret)
	if secret == "" {
		return ""
	}
	if len(secret) <= 4 {
		return "****"
	}
	return secret[:2] + strings.Repeat("*", len(secret)-4) + secret[len(secret)-2:]
}

func applyFeishuPayload(connector *models.FeishuConnector, payload map[string]any) error {
	if connector == nil {
		return apperrors.New(apperrors.ErrInvalidInput, "connector is required")
	}

	setString := func(target *string, keys ...string) {
		if v, ok := lookupString(payload, keys...); ok {
			*target = strings.TrimSpace(v)
		}
	}
	setBool := func(target *bool, keys ...string) {
		if v, ok := lookupBool(payload, keys...); ok {
			*target = v
		}
	}
	setInt := func(target *int, keys ...string) {
		if v, ok := lookupInt(payload, keys...); ok {
			*target = v
		}
	}

	setString(&connector.ConnectorName, "connector_name", "connectorName")
	setString(&connector.AppID, "app_id", "appId")
	setString(&connector.AppSecret, "app_secret", "appSecret")
	setString(&connector.VerificationToken, "verification_token", "verificationToken")
	setString(&connector.EncryptKey, "encrypt_key", "encryptKey")
	setBool(&connector.AllowDM, "allow_dm", "allowDm")
	setBool(&connector.AllowGroupMention, "allow_group_mention", "allowGroupMention")
	setBool(&connector.MentionRequired, "mention_required", "mentionRequired")
	setString(&connector.PrefixCommand, "prefix_command", "prefixCommand")
	setBool(&connector.IgnoreBotMessages, "ignore_bot_messages", "ignoreBotMessages")
	setInt(&connector.RateLimitPerMinute, "rate_limit_per_minute", "rateLimitPerMinute")
	setString(&connector.CallbackURL, "callback_url", "callbackUrl")

	if values, ok := lookupStringList(payload, "allowed_chat_ids", "allowedChatIds"); ok {
		connector.AllowedChatIDs = values
	}
	if values, ok := lookupStringList(payload, "user_whitelist", "userWhitelist"); ok {
		connector.UserWhitelist = values
	}

	if connector.RateLimitPerMinute <= 0 {
		return apperrors.New(apperrors.ErrInvalidInput, "rate_limit_per_minute must be > 0")
	}

	return nil
}

func enforceFeishuServerManagedDefaults(connector *models.FeishuConnector) {
	if connector == nil {
		return
	}
	connector.Enabled = false
	connector.Status = "not_connected"
	connector.CallbackVerified = false
	connector.LastVerifiedAt = nil
}

func copyFeishuServerManagedFields(dst *models.FeishuConnector, existing models.FeishuConnector) {
	if dst == nil {
		return
	}
	dst.Enabled = existing.Enabled
	dst.Status = existing.Status
	dst.CallbackVerified = existing.CallbackVerified
	dst.LastVerifiedAt = existing.LastVerifiedAt
}

func shouldInvalidateFeishuVerification(before, after models.FeishuConnector) bool {
	return !strings.EqualFold(strings.TrimSpace(before.AppID), strings.TrimSpace(after.AppID)) ||
		!strings.EqualFold(strings.TrimSpace(before.VerificationToken), strings.TrimSpace(after.VerificationToken)) ||
		!strings.EqualFold(strings.TrimSpace(before.CallbackURL), strings.TrimSpace(after.CallbackURL))
}

func invalidateFeishuVerification(connector *models.FeishuConnector) {
	if connector == nil {
		return
	}
	connector.CallbackVerified = false
	connector.LastVerifiedAt = nil
	connector.Enabled = false
	connector.Status = "not_connected"
}

func lookupString(payload map[string]any, keys ...string) (string, bool) {
	for _, key := range keys {
		if value, exists := payload[key]; exists {
			if s, ok := value.(string); ok {
				return s, true
			}
		}
	}
	return "", false
}

func lookupBool(payload map[string]any, keys ...string) (bool, bool) {
	for _, key := range keys {
		if value, exists := payload[key]; exists {
			switch v := value.(type) {
			case bool:
				return v, true
			case string:
				parsed := strings.EqualFold(strings.TrimSpace(v), "true")
				return parsed, true
			}
		}
	}
	return false, false
}

func lookupInt(payload map[string]any, keys ...string) (int, bool) {
	for _, key := range keys {
		if value, exists := payload[key]; exists {
			switch v := value.(type) {
			case float64:
				return int(v), true
			case int:
				return v, true
			case string:
				parsed, err := strconv.Atoi(strings.TrimSpace(v))
				if err != nil {
					return 0, false
				}
				return parsed, true
			}
		}
	}
	return 0, false
}

func lookupStringList(payload map[string]any, keys ...string) ([]string, bool) {
	for _, key := range keys {
		value, exists := payload[key]
		if !exists {
			continue
		}

		switch v := value.(type) {
		case string:
			return splitCommaList(v), true
		case []any:
			out := make([]string, 0, len(v))
			for _, item := range v {
				if s, ok := item.(string); ok {
					trimmed := strings.TrimSpace(s)
					if trimmed != "" {
						out = append(out, trimmed)
					}
				}
			}
			return out, true
		case []string:
			return v, true
		}
	}
	return nil, false
}

func splitCommaList(raw string) []string {
	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed != "" {
			out = append(out, trimmed)
		}
	}
	return out
}

func stringFromPayload(payload map[string]any, key string) (string, bool) {
	if payload == nil {
		return "", false
	}
	value, ok := payload[key]
	if !ok {
		return "", false
	}
	v, ok := value.(string)
	return v, ok
}

func mapFromPayload(payload map[string]any, key string) map[string]any {
	if payload == nil {
		return map[string]any{}
	}
	if value, ok := payload[key]; ok {
		if m, ok := value.(map[string]any); ok {
			return m
		}
	}
	return map[string]any{}
}

func listFromMap(payload map[string]any, key string) []any {
	if payload == nil {
		return nil
	}
	if value, ok := payload[key]; ok {
		if list, ok := value.([]any); ok {
			return list
		}
	}
	return nil
}

func stringFromMap(payload map[string]any, key string) string {
	if payload == nil {
		return ""
	}
	value, ok := payload[key]
	if !ok {
		return ""
	}
	if s, ok := value.(string); ok {
		return s
	}
	return ""
}

func firstNonEmptyString(values ...string) string {
	for _, value := range values {
		if trimmed := strings.TrimSpace(value); trimmed != "" {
			return trimmed
		}
	}
	return ""
}
