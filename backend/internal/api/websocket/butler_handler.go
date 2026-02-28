package websocket

import (
	"context"
	"encoding/json"
	"log"
	"strings"
	"sync"
)

// ButlerMessageCallback is called when a user sends a message to Butler
// This is set by the butler package during initialization
var ButlerMessageCallback func(ctx context.Context, senderID int, payload string)

// AgentResponseCallback is called when an agent response is received
// This is set by the butler package during initialization
var AgentResponseCallback func(agentID int, payload string) bool

// ButlerMessageHandler handles WebSocket messages for the Butler
// This bridges WebSocket messages to the Butler service
type ButlerMessageHandler struct {
	butlerID int
}

// NewButlerMessageHandler creates a new Butler message handler
func NewButlerMessageHandler(butlerID int) *ButlerMessageHandler {
	return &ButlerMessageHandler{
		butlerID: butlerID,
	}
}

// HandleMessage processes incoming WebSocket messages for Butler
func (h *ButlerMessageHandler) HandleMessage(ctx context.Context, msg *Message) {
	if msg == nil {
		return
	}

	switch msg.Type {
	case MessageTypeChat:
		if msg.TargetID == h.butlerID && msg.SenderID != h.butlerID {
			payload, ok := msg.Payload.(string)
			if !ok {
				return
			}
			log.Printf("[Butler Handler] Received chat from user %d: %s", msg.SenderID, payload)
			if ButlerMessageCallback != nil {
				go ButlerMessageCallback(ctx, msg.SenderID, payload)
			}
		}

	case MessageTypeSystemLog:
		// Butler can observe system logs for situational awareness
	}
}

// streamBuffer holds accumulated stream content
type streamBuffer struct {
	content strings.Builder
	mu      sync.Mutex
}

// ButlerWebSocketHandler handles WebSocket messages from Agents to Butler
// This processes CHAT and CHAT_STREAM responses from agents
type ButlerWebSocketHandler struct {
	butlerID int
	buffers  map[int]*streamBuffer // agentID -> buffer
	mu       sync.RWMutex
}

// NewButlerWebSocketHandler creates a new WebSocket handler for Butler
func NewButlerWebSocketHandler(butlerID int) *ButlerWebSocketHandler {
	return &ButlerWebSocketHandler{
		butlerID: butlerID,
		buffers:  make(map[int]*streamBuffer),
	}
}

// HandleMessage processes incoming WebSocket messages from agents
func (h *ButlerWebSocketHandler) HandleMessage(ctx context.Context, msg *Message) {
	if msg == nil {
		return
	}

	// Only handle messages targeted at Butler
	if msg.TargetID != h.butlerID {
		return
	}

	// Handle CHAT and CHAT_STREAM messages from AGENTs
	if msg.Type != MessageTypeChat && msg.Type != MessageTypeChatStream && msg.Type != MessageTypeChatStreamEnd {
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
	case MessageTypeChat:
		// Direct CHAT message - register immediately
		cleanPayload := strings.Trim(payload, "\"")
		if AgentResponseCallback != nil {
			if registered := AgentResponseCallback(msg.SenderID, cleanPayload); registered {
				log.Printf("[Butler WS Handler] Successfully registered CHAT response from Agent %d", msg.SenderID)
			}
		}

	case MessageTypeChatStream:
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

	case MessageTypeChatStreamEnd:
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
			if AgentResponseCallback != nil {
				if registered := AgentResponseCallback(msg.SenderID, cleanPayload); registered {
					log.Printf("[Butler WS Handler] Successfully registered STREAM response from Agent %d (length: %d)", msg.SenderID, len(cleanPayload))
				} else {
					log.Printf("[Butler WS Handler] No pending listener for Agent %d stream", msg.SenderID)
				}
			}
		}
	}
}

func truncateString(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen] + "..."
}
