package websocket

import (
	"log"
	"sync"
	"github.com/lea/echocenter/backend/internal/database"
)

// Message defines the structure of WebSocket messages
type Message struct {
	Type       string      `json:"type"`
	SenderID   int         `json:"sender_id"`
	SenderName string      `json:"sender_name"`
	TargetID   int         `json:"target_id,omitempty"`
	Payload    interface{} `json:"payload"`
	Timestamp  string      `json:"timestamp"`
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
				if target, ok := h.clients[message.TargetID]; ok {
					select {
					case target.send <- message:
					default:
						// If send buffer full, drop client (unregister)
						go func() { h.unregister <- target }()
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
