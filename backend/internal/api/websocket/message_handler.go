package websocket

import (
	"context"
	"encoding/json"
	"log"
	"time"

	"github.com/lea/echocenter/backend/internal/models"
	"github.com/lea/echocenter/backend/internal/repository"
)

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
