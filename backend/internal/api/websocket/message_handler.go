package websocket

import (
	"context"
	"encoding/json"
	"log"
	"strings"
	"sync"
	"time"

	"github.com/lea/echocenter/backend/internal/models"
	"github.com/lea/echocenter/backend/internal/repository"
)

// streamBuffer holds accumulated stream content
type persistStreamBuffer struct {
	content  strings.Builder
	targetID int
	mu       sync.Mutex
}

// PersistingMessageHandler saves CHAT messages to the database
type PersistingMessageHandler struct {
	repo    repository.Repository
	buffers map[int]*persistStreamBuffer // senderID -> buffer
	mu      sync.RWMutex
}

// NewPersistingMessageHandler creates a new handler that persists messages
func NewPersistingMessageHandler(repo repository.Repository) *PersistingMessageHandler {
	return &PersistingMessageHandler{
		repo:    repo,
		buffers: make(map[int]*persistStreamBuffer),
	}
}

// HandleMessage processes incoming messages and saves CHAT type to DB
func (h *PersistingMessageHandler) HandleMessage(ctx context.Context, msg *Message) {
	if msg == nil || h.repo == nil {
		return
	}

	// Only persist CHAT-related messages
	if msg.Type != MessageTypeChat && msg.Type != MessageTypeChatStream && msg.Type != MessageTypeChatStreamEnd {
		return
	}

	// Only persist messages involving User (ID 1)
	// This includes User <-> Butler and User <-> Agent conversations
	// Skip messages between Butler and other Agents (Butler <-> Agent)
	const userID = 1
	if msg.SenderID != userID && msg.TargetID != userID {
		log.Printf("[PersistingMessageHandler] Skipping message from %d to %d (not involving User)", msg.SenderID, msg.TargetID)
		return
	}

	switch msg.Type {
	case MessageTypeChat:
		// Handle direct chat messages
		h.handleChatMessage(ctx, msg)
	case MessageTypeChatStream:
		// Accumulate stream content
		h.handleChatStream(ctx, msg)
	case MessageTypeChatStreamEnd:
		// Save accumulated stream content
		h.handleChatStreamEnd(ctx, msg)
	}
}

// handleChatMessage handles direct chat messages
func (h *PersistingMessageHandler) handleChatMessage(ctx context.Context, msg *Message) {
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

// handleChatStream accumulates stream content
func (h *PersistingMessageHandler) handleChatStream(ctx context.Context, msg *Message) {
	log.Printf("[PersistingMessageHandler] Accumulating CHAT_STREAM from %d to %d", msg.SenderID, msg.TargetID)

	// Convert payload to string
	var payloadStr string
	switch p := msg.Payload.(type) {
	case string:
		payloadStr = p
	default:
		bytes, _ := json.Marshal(p)
		payloadStr = string(bytes)
	}

	// Get or create buffer for this sender
	h.mu.Lock()
	buf, ok := h.buffers[msg.SenderID]
	if !ok {
		buf = &persistStreamBuffer{
			targetID: msg.TargetID,
		}
		h.buffers[msg.SenderID] = buf
	}
	h.mu.Unlock()

	// Accumulate content
	buf.mu.Lock()
	buf.content.WriteString(payloadStr)
	buf.mu.Unlock()
}

// handleChatStreamEnd saves accumulated stream content
func (h *PersistingMessageHandler) handleChatStreamEnd(ctx context.Context, msg *Message) {
	// Get and remove buffer for this sender
	h.mu.Lock()
	buf, ok := h.buffers[msg.SenderID]
	if ok {
		delete(h.buffers, msg.SenderID)
	}
	h.mu.Unlock()

	if !ok {
		log.Printf("[PersistingMessageHandler] No buffer found for CHAT_STREAM_END from %d", msg.SenderID)
		return
	}

	// Get accumulated content
	buf.mu.Lock()
	payloadStr := buf.content.String()
	buf.mu.Unlock()

	if payloadStr == "" {
		log.Printf("[PersistingMessageHandler] Empty stream content from %d", msg.SenderID)
		return
	}

	log.Printf("[PersistingMessageHandler] Persisting CHAT_STREAM_END from %d to %d (length: %d)", msg.SenderID, buf.targetID, len(payloadStr))

	// Save to database
	chatMsg := &models.ChatMessage{
		SenderID:   msg.SenderID,
		ReceiverID: buf.targetID,
		Payload:    payloadStr,
	}

	if err := h.repo.SaveChatMessage(ctx, chatMsg); err != nil {
		log.Printf("[PersistingMessageHandler] Failed to save stream message: %v", err)
	} else {
		log.Printf("[PersistingMessageHandler] Successfully saved stream message from %d to %d", msg.SenderID, buf.targetID)
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
