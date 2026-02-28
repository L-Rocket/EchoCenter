package butler

import (
	"context"
	"encoding/json"
	"log"
	"strings"
	"sync"

	"github.com/lea/echocenter/backend/internal/api/websocket"
)

// streamBuffer holds accumulated stream content
type streamBuffer struct {
	content strings.Builder
	mu      sync.Mutex
}

// WebSocketHandler handles WebSocket messages for Butler
type WebSocketHandler struct {
	butlerID int
	buffers  map[int]*streamBuffer // agentID -> buffer
	mu       sync.RWMutex
}

// NewWebSocketHandler creates a new WebSocket handler for Butler
func NewWebSocketHandler(butlerID int) *WebSocketHandler {
	return &WebSocketHandler{
		butlerID: butlerID,
		buffers:  make(map[int]*streamBuffer),
	}
}

// HandleMessage processes incoming WebSocket messages
func (h *WebSocketHandler) HandleMessage(ctx context.Context, msg *websocket.Message) {
	if msg == nil {
		return
	}

	// Only handle messages targeted at Butler
	if msg.TargetID != h.butlerID {
		return
	}

	// Handle CHAT and CHAT_STREAM messages from AGENTs
	if msg.Type != websocket.MessageTypeChat && msg.Type != websocket.MessageTypeChatStream && msg.Type != websocket.MessageTypeChatStreamEnd {
		return
	}

	// Extract payload
	var payload string
	switch p := msg.Payload.(type) {
	case string:
		payload = p
	default:
		if bytes, err := json.Marshal(p); err == nil {
			payload = string(bytes)
		}
	}

	log.Printf("[Butler WS Handler] Received %s from Agent %d: %s", msg.Type, msg.SenderID, truncateString(payload, 50))

	switch msg.Type {
	case websocket.MessageTypeChat:
		// Direct CHAT message - register immediately
		cleanPayload := strings.Trim(payload, "\"")
		if registered := RegisterAgentResponse(msg.SenderID, cleanPayload); registered {
			log.Printf("[Butler WS Handler] Successfully registered CHAT response from Agent %d", msg.SenderID)
		}

	case websocket.MessageTypeChatStream:
		// Accumulate stream content
		h.mu.Lock()
		buf, ok := h.buffers[msg.SenderID]
		if !ok {
			buf = &streamBuffer{}
			h.buffers[msg.SenderID] = buf
		}
		h.mu.Unlock()

		buf.mu.Lock()
		buf.content.WriteString(payload)
		buf.mu.Unlock()
		log.Printf("[Butler WS Handler] Accumulated stream chunk from Agent %d", msg.SenderID)

	case websocket.MessageTypeChatStreamEnd:
		// Send accumulated content
		h.mu.Lock()
		buf, ok := h.buffers[msg.SenderID]
		if ok {
			delete(h.buffers, msg.SenderID)
		}
		h.mu.Unlock()

		if ok {
			buf.mu.Lock()
			fullContent := buf.content.String()
			buf.mu.Unlock()

			cleanPayload := strings.Trim(fullContent, "\"")
			if registered := RegisterAgentResponse(msg.SenderID, cleanPayload); registered {
				log.Printf("[Butler WS Handler] Successfully registered STREAM response from Agent %d (length: %d)", msg.SenderID, len(cleanPayload))
			} else {
				log.Printf("[Butler WS Handler] No pending listener for Agent %d stream", msg.SenderID)
			}
		}
	}
}
