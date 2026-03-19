package websocket

import (
	"context"
	"encoding/json"
	"log"
	"strings"
	"time"

	"github.com/lea/echocenter/backend/internal/butler"
	"github.com/lea/echocenter/backend/internal/models"
	"github.com/lea/echocenter/backend/internal/repository"
)

// AgentResponseHandler handles responses from agents
type AgentResponseHandler struct{}

// NewAgentResponseHandler creates a new handler for agent responses
func NewAgentResponseHandler() *AgentResponseHandler {
	return &AgentResponseHandler{}
}

// HandleMessage processes messages from agents and registers them as responses
func (h *AgentResponseHandler) HandleMessage(ctx context.Context, msg *Message) {
	if msg == nil {
		return
	}

	// Only handle CHAT messages from AGENTS (responses to Butler commands)
	if msg.Type != MessageTypeChat || msg.SenderRole != "AGENT" {
		return
	}

	// Check if there's a pending response for this agent
	// Convert payload to string
	var payloadStr string
	switch p := msg.Payload.(type) {
	case string:
		payloadStr = p
	default:
		bytes, _ := json.Marshal(p)
		payloadStr = string(bytes)
	}

	log.Printf("[AgentResponseHandler] Checking for pending response from Agent %d", msg.SenderID)

	// Register the response with the butler tool
	butler.RegisterAgentResponse(msg.SenderID, payloadStr)
}

// AuthResponseHandler handles authorization responses from users
type AuthResponseHandler struct {
	butlerID int
}

// NewAuthResponseHandler creates a new handler for auth responses
func NewAuthResponseHandler(butlerID int) *AuthResponseHandler {
	return &AuthResponseHandler{butlerID: butlerID}
}

// HandleMessage processes AUTH_RESPONSE messages from users
func (h *AuthResponseHandler) HandleMessage(ctx context.Context, msg *Message) {
	if msg == nil {
		return
	}

	// Only handle AUTH_RESPONSE messages sent to Butler
	if msg.Type != MessageTypeAuthResponse || msg.TargetID != h.butlerID {
		return
	}

	// Get Butler service
	butlerService := butler.GetButler()
	if butlerService == nil {
		log.Println("[AuthResponseHandler] Butler service not initialized")
		return
	}

	// Parse payload
	var payload struct {
		ActionID string `json:"action_id"`
		Approved bool   `json:"approved"`
	}

	if err := msg.ParsePayload(&payload); err != nil {
		log.Printf("[AuthResponseHandler] Failed to parse payload: %v", err)
		return
	}

	log.Printf("[AuthResponseHandler] Processing AUTH_RESPONSE for action %s: approved=%v", payload.ActionID, payload.Approved)

	// Execute or cancel the pending command
	go butlerService.ExecutePendingCommand(ctx, payload.ActionID, msg.SenderID, payload.Approved)
}

// ButlerMessageHandler handles messages sent to Butler
type ButlerMessageHandler struct {
	butlerID int
}

// NewButlerMessageHandler creates a new handler for Butler messages
func NewButlerMessageHandler(butlerID int) *ButlerMessageHandler {
	return &ButlerMessageHandler{butlerID: butlerID}
}

// HandleMessage processes messages sent to Butler
func (h *ButlerMessageHandler) HandleMessage(ctx context.Context, msg *Message) {
	if msg == nil {
		return
	}

	// Only handle messages sent to Butler, and IGNORE messages from AGENTs
	// to prevent infinite loops (Agents replying to Butler, Butler thinking it's a user prompt).
	if msg.TargetID != h.butlerID || msg.SenderRole == "AGENT" {
		return
	}

	// Only handle CHAT messages
	if msg.Type != MessageTypeChat {
		return
	}

	// Get Butler service
	butlerService := butler.GetButler()
	if butlerService == nil {
		log.Println("[ButlerMessageHandler] Butler service not initialized")
		return
	}

	// Convert payload to string
	var payloadStr string
	switch p := msg.Payload.(type) {
	case string:
		payloadStr = p
	default:
		bytes, _ := json.Marshal(p)
		payloadStr = string(bytes)
	}

	log.Printf("[ButlerMessageHandler] Processing message from %d to Butler: %s", msg.SenderID, payloadStr)

	// Handle the message
	butlerService.HandleUserMessageWithConversation(ctx, msg.SenderID, msg.ConversationID, payloadStr)
}

// PersistingMessageHandler saves CHAT messages to the database
type PersistingMessageHandler struct {
	repo repository.Repository
}

// NewPersistingMessageHandler creates a new handler that persists messages
func NewPersistingMessageHandler(repo repository.Repository) *PersistingMessageHandler {
	return &PersistingMessageHandler{repo: repo}
}

// HandleMessage processes incoming messages and saves CHAT type to DB
func (h *PersistingMessageHandler) HandleMessage(ctx context.Context, msg *Message) {
	if msg == nil || h.repo == nil {
		return
	}

	// Only persist CHAT messages (not SYSTEM_LOG or AUTH_REQUEST)
	if msg.Type != MessageTypeChat {
		return
	}

	if shouldSkipRuntimeOnlyChat(msg.Payload) {
		log.Printf("[PersistingMessageHandler] Skipping runtime-only Butler message from %d to %d", msg.SenderID, msg.TargetID)
		return
	}

	if !h.shouldPersistMessage(ctx, msg) {
		log.Printf("[PersistingMessageHandler] Skipping message from %d to %d (persistence policy)", msg.SenderID, msg.TargetID)
		return
	}

	log.Printf("[PersistingMessageHandler] Persisting CHAT message from %d to %d", msg.SenderID, msg.TargetID)

	// Convert payload to string
	var payloadStr string
	switch p := msg.Payload.(type) {
	case string:
		payloadStr = p
	default:
		bytes, _ := json.Marshal(p)
		payloadStr = string(bytes)
	}

	// If the message already has an ID, it was saved upstream (e.g., by ButlerService).
	// We should skip saving it again to prevent duplicates.
	if msg.ID > 0 {
		log.Printf("[PersistingMessageHandler] Message %s already has ID %d, skipping save", msg.LocalID, msg.ID)
		return
	}

	// Save to database
	chatMsg := &models.ChatMessage{
		ConversationID: msg.ConversationID,
		LocalID:    msg.LocalID,
		SenderID:   msg.SenderID,
		ReceiverID: msg.TargetID,
		Payload:    payloadStr,
	}

	if err := h.repo.SaveChatMessage(ctx, chatMsg); err != nil {
		log.Printf("[PersistingMessageHandler] Failed to save message: %v", err)
	} else {
		log.Printf("[PersistingMessageHandler] Successfully saved message from %d to %d (ID: %d)", msg.SenderID, msg.TargetID, chatMsg.ID)
		// CRITICAL: Fill back the database ID and accurate timestamp into the broadcast message
		msg.ID = chatMsg.ID
		msg.ConversationID = chatMsg.ConversationID
		msg.Timestamp = chatMsg.Timestamp.Format(time.RFC3339Nano)
		// Keep the LocalID in the broadcast so frontend can match it
		msg.LocalID = chatMsg.LocalID
	}
}

type userLookupRepository interface {
	GetUserByID(ctx context.Context, id int) (*models.User, error)
	GetUsers(ctx context.Context) ([]models.User, error)
}

// ButlerAgentMonitorHandler emits monitor events for Butler<->Agent CHAT traffic.
type ButlerAgentMonitorHandler struct {
	repo userLookupRepository
	emit func(any)
}

// NewButlerAgentMonitorHandler creates a monitor stream handler.
func NewButlerAgentMonitorHandler(repo userLookupRepository) *ButlerAgentMonitorHandler {
	return &ButlerAgentMonitorHandler{repo: repo}
}

// SetEmitter wires a broadcast sink (typically hub.BroadcastGeneric).
func (h *ButlerAgentMonitorHandler) SetEmitter(emit func(any)) {
	h.emit = emit
}

// HandleMessage emits BUTLER_AGENT_MESSAGE when Butler and Agent exchange CHAT messages.
func (h *ButlerAgentMonitorHandler) HandleMessage(ctx context.Context, msg *Message) {
	if msg == nil || msg.Type != MessageTypeChat || msg.TargetID == 0 || h.repo == nil || h.emit == nil {
		return
	}

	if shouldSkipRuntimeOnlyChat(msg.Payload) {
		return
	}

	sender, err := h.repo.GetUserByID(ctx, msg.SenderID)
	if err != nil || sender == nil {
		return
	}
	receiver, err := h.repo.GetUserByID(ctx, msg.TargetID)
	if err != nil || receiver == nil {
		return
	}

	if !isButlerAgentPair(sender, receiver) {
		return
	}

	agentID := sender.ID
	if strings.EqualFold(sender.Role, "BUTLER") {
		agentID = receiver.ID
	}

	senderRole := strings.ToUpper(strings.TrimSpace(msg.SenderRole))
	if senderRole == "" {
		senderRole = strings.ToUpper(strings.TrimSpace(sender.Role))
	}

	senderName := strings.TrimSpace(msg.SenderName)
	if senderName == "" {
		senderName = sender.Username
	}

	timestamp := strings.TrimSpace(msg.Timestamp)
	if timestamp == "" {
		timestamp = time.Now().Format(time.RFC3339Nano)
	}

	payload := map[string]any{
		"agent_id":    agentID,
		"type":        string(msg.Type),
		"sender_id":   msg.SenderID,
		"sender_role": senderRole,
		"sender_name": senderName,
		"payload":     msg.Payload,
		"timestamp":   timestamp,
	}
	if msg.ID > 0 {
		payload["id"] = msg.ID
	}

	recipients := h.monitorRecipientIDs(ctx)
	for _, recipientID := range recipients {
		h.emit(map[string]any{
			"type":        string(MessageTypeButlerAgent),
			"sender_id":   msg.SenderID,
			"sender_name": senderName,
			"sender_role": senderRole,
			"target_id":   recipientID,
			"payload":     payload,
			"timestamp":   timestamp,
		})
	}
}

// CompositeHandler combines multiple handlers
type CompositeHandler struct {
	handlers []MessageHandler
}

// NewCompositeHandler creates a handler that calls all provided handlers
func NewCompositeHandler(handlers ...MessageHandler) *CompositeHandler {
	return &CompositeHandler{handlers: handlers}
}

// HandleMessage calls all registered handlers
func (h *CompositeHandler) HandleMessage(ctx context.Context, msg *Message) {
	for _, handler := range h.handlers {
		if _, isPersist := handler.(*PersistingMessageHandler); isPersist {
			// Run persistence synchronously so msg.ID is populated BEFORE broadcasting
			handler.HandleMessage(ctx, msg)
		} else {
			// Run other handlers (like Butler LLM calls) asynchronously
			go handler.HandleMessage(ctx, msg)
		}
	}
}

func (h *PersistingMessageHandler) shouldPersistMessage(ctx context.Context, msg *Message) bool {
	sender, err := h.repo.GetUserByID(ctx, msg.SenderID)
	if err != nil {
		log.Printf("[PersistingMessageHandler] failed to load sender %d: %v (fallback to persist)", msg.SenderID, err)
		return true
	}

	receiver, err := h.repo.GetUserByID(ctx, msg.TargetID)
	if err != nil {
		log.Printf("[PersistingMessageHandler] failed to load receiver %d: %v (fallback to persist)", msg.TargetID, err)
		return true
	}

	return shouldPersistChatPair(sender, receiver, msg.SenderRole)
}

func shouldSkipRuntimeOnlyChat(payload any) bool {
	content, ok := payload.(string)
	if !ok {
		return false
	}
	return strings.HasPrefix(strings.TrimSpace(content), butler.RuntimeQuestionPrefix())
}

func shouldPersistChatPair(sender, receiver *models.User, senderRole string) bool {
	if isHumanActor(sender) || isHumanActor(receiver) {
		return true
	}
	if isButlerAgentPair(sender, receiver) {
		return true
	}
	// Fallback compatibility for old rows before actor_type backfill.
	return !isSystemRole(senderRole)
}

func isHumanActor(user *models.User) bool {
	if user == nil {
		return false
	}
	if strings.EqualFold(strings.TrimSpace(user.ActorType), "HUMAN") {
		return true
	}
	if strings.EqualFold(strings.TrimSpace(user.ActorType), "SYSTEM") {
		return false
	}
	return !isSystemRole(user.Role)
}

func isSystemRole(role string) bool {
	normalized := strings.ToUpper(strings.TrimSpace(role))
	return normalized == "AGENT" || normalized == "BUTLER"
}

func isButlerAgentPair(sender, receiver *models.User) bool {
	if sender == nil || receiver == nil {
		return false
	}
	return (strings.EqualFold(sender.Role, "BUTLER") && strings.EqualFold(receiver.Role, "AGENT")) ||
		(strings.EqualFold(sender.Role, "AGENT") && strings.EqualFold(receiver.Role, "BUTLER"))
}

func (h *ButlerAgentMonitorHandler) monitorRecipientIDs(ctx context.Context) []int {
	users, err := h.repo.GetUsers(ctx)
	if err != nil {
		log.Printf("[ButlerAgentMonitorHandler] failed to load recipients: %v", err)
		return nil
	}

	recipientIDs := make([]int, 0, len(users))
	for _, user := range users {
		if strings.EqualFold(user.Role, "ADMIN") {
			recipientIDs = append(recipientIDs, user.ID)
		}
	}
	return recipientIDs
}

// TimeoutContext wraps a context with a timeout for handler execution
func TimeoutContext(parent context.Context, timeout time.Duration) (context.Context, context.CancelFunc) {
	return context.WithTimeout(parent, timeout)
}
