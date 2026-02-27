package websocket

import (
	"context"
	"log"
	"sync"
	"time"
	"github.com/lea/echocenter/backend/internal/database"
	"github.com/lea/echocenter/backend/internal/butler"
	"github.com/lea/echocenter/backend/internal/models"
)

// Message defines the structure of WebSocket messages
type Message struct {
	Type       string      `json:"type"`
	SenderID   int         `json:"sender_id"`
	SenderName string      `json:"sender_name"`
	SenderRole string      `json:"sender_role"` // USER, BUTLER, or AGENT
	TargetID   int         `json:"target_id,omitempty"`
	Payload    interface{} `json:"payload"`
	Timestamp  string      `json:"timestamp"`
	StreamID   string      `json:"stream_id,omitempty"`
}

// Hub maintains the set of active clients and broadcasts messages
type Hub struct {
	// Registered clients by User ID
	clients map[int]*Client
	// Inbound messages from the clients
	broadcast chan *Message
	// Register requests from the clients
	register chan *Client
	// Unregister requests from clients
	unregister chan *Client
	// Mutex for client map
	mu sync.RWMutex
}

func NewHub() *Hub {
	return &Hub{
		broadcast:  make(chan *Message),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		clients:    make(map[int]*Client),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client.userID] = client
			h.mu.Unlock()
			log.Printf("User %d registered to WebSocket hub", client.userID)

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client.userID]; ok {
				delete(h.clients, client.userID)
				close(client.send)
				log.Printf("User %d unregistered from WebSocket hub", client.userID)
			}
			h.mu.Unlock()

		case message := <-h.broadcast:
			// Butler Situational Awareness (US1)
			if message.Type == "SYSTEM_LOG" {
				if b := butler.GetButler(); b != nil {
					if logMsg, ok := message.Payload.(models.Message); ok {
						go b.ProcessLog(context.Background(), logMsg)
					}
				}
			}

			// Direct Chat to Butler
			if message.Type == "CHAT" || message.Type == "CHAT_STREAM" {
				if b := butler.GetButler(); b != nil && message.TargetID == b.GetButlerID() {
					payload, ok := message.Payload.(string)
					if ok {
											// 1. Try to feed to a waiting tool first (Registry)
											if butler.RegisterAgentResponse(message.SenderID, payload) {
												log.Printf("Relayed agent %d response to butler tool", message.SenderID)
											} else if message.SenderRole == "USER" && message.SenderID != b.GetButlerID() {
												// 2. Only start a NEW reasoning session if the sender is an actual human USER
												// and it's NOT the butler sending to itself.
												go b.HandleUserMessage(context.Background(), message.SenderID, payload)
											}
						
					}
				}
			}

			// Persist CHAT messages asynchronously (T005)
			if message.Type == "CHAT" && message.TargetID != 0 {
				go func(m *Message) {
					// We need to handle the payload as string
					content, ok := m.Payload.(string)
					if ok {
						err := database.SaveChatMessage(m.SenderID, m.TargetID, content)
						if err != nil {
							log.Printf("Failed to save chat message: %v", err)
						}
					}
				}(message)
			}

			// Route to specific target if present
			if message.TargetID != 0 {
				h.mu.RLock()
				// Send to target
				if target, ok := h.clients[message.TargetID]; ok {
					select {
					case target.send <- message:
					default:
						// If send buffer full, drop client (unregister)
						go func() { h.unregister <- target }()
					}
				}
				// Also send back to sender so they see it in their UI (for CHAT and CHAT_STREAM)
				if (message.Type == "CHAT" || message.Type == "CHAT_STREAM" || message.Type == "CHAT_STREAM_END") {
					if sender, ok := h.clients[message.SenderID]; ok && message.SenderID != message.TargetID {
						select {
						case sender.send <- message:
						default:
							go func() { h.unregister <- sender }()
						}
					}
				}
				h.mu.RUnlock()
			} else {
				// Broadcast to all (optional, depends on use case)
				h.mu.RLock()
				for _, client := range h.clients {
					select {
					case client.send <- message:
					default:
						go func() { h.unregister <- client }()
					}
				}
				h.mu.RUnlock()
			}
		}
	}
}

func (h *Hub) Broadcast(message *Message) {
	h.broadcast <- message
}

// BroadcastGeneric allows other packages to broadcast without importing websocket (T013)
func (h *Hub) BroadcastGeneric(msg interface{}) {
	if m, ok := msg.(*Message); ok {
		h.broadcast <- m
		return
	}

	// Try to convert map to Message
	if data, ok := msg.(map[string]interface{}); ok {
		m := &Message{
			Type:      data["type"].(string),
			Payload:   data["payload"],
			Timestamp: time.Now().Format(time.RFC3339),
		}
		if sid, ok := data["sender_id"].(int); ok {
			m.SenderID = sid
		}
		if tid, ok := data["target_id"].(int); ok {
			m.TargetID = tid
		}
		if sname, ok := data["sender_name"].(string); ok {
			m.SenderName = sname
		}
		if srole, ok := data["sender_role"].(string); ok {
			m.SenderRole = srole
		}
		if stid, ok := data["stream_id"].(string); ok {
			m.StreamID = stid
		}
		h.broadcast <- m
	}
}
