package websocket

import (
	"context"
	"encoding/json"
	"log"
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

	// Only handle CHAT messages (responses to Butler commands)
	if msg.Type != MessageTypeChat {
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

	// Only handle messages sent to Butler
	if msg.TargetID != h.butlerID {
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
	butlerService.HandleUserMessage(ctx, msg.SenderID, payloadStr)
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

	// Only persist messages involving User (ID 1)
	// This includes User <-> Butler and User <-> Agent conversations
	// Skip messages between Butler and other Agents (Butler <-> Agent)
	const userID = 1
	const butlerID = 2
	if msg.SenderID != userID && msg.TargetID != userID {
		log.Printf("[PersistingMessageHandler] Skipping message from %d to %d (not involving User)", msg.SenderID, msg.TargetID)
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

	// Save to database
	chatMsg := &models.ChatMessage{
		SenderID:   msg.SenderID,
		ReceiverID: msg.TargetID,
		Payload:    payloadStr,
	}

	if err := h.repo.SaveChatMessage(ctx, chatMsg); err != nil {
		log.Printf("[PersistingMessageHandler] Failed to save message: %v", err)
	} else {
		log.Printf("[PersistingMessageHandler] Successfully saved message from %d to %d", msg.SenderID, msg.TargetID)
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
		go handler.HandleMessage(ctx, msg)
	}
}

// TimeoutContext wraps a context with a timeout for handler execution
func TimeoutContext(parent context.Context, timeout time.Duration) (context.Context, context.CancelFunc) {
	return context.WithTimeout(parent, timeout)
}
