package websocket

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	apperrors "github.com/lea/echocenter/backend/pkg/errors"
)

const (
	// Time allowed to write a message to the peer
	writeWait = 10 * time.Second

	// Time allowed to read the next pong message from the peer
	pongWait = 60 * time.Second

	// Send pings to peer with this period. Must be less than pongWait
	pingPeriod = (pongWait * 9) / 10

	// Maximum message size allowed from peer
	maxMessageSize = 512

	// Send buffer size
	sendBufferSize = 256
)

// MessageType represents the type of WebSocket message
type MessageType string

const (
	MessageTypeSystemLog     MessageType = "SYSTEM_LOG"
	MessageTypeChat          MessageType = "CHAT"
	MessageTypeChatStream    MessageType = "CHAT_STREAM"
	MessageTypeChatStreamEnd MessageType = "CHAT_STREAM_END"
)

// Message represents a WebSocket message
type Message struct {
	Type       MessageType `json:"type"`
	SenderID   int         `json:"sender_id"`
	SenderName string      `json:"sender_name"`
	SenderRole string      `json:"sender_role"`
	TargetID   int         `json:"target_id,omitempty"`
	Payload    interface{} `json:"payload"`
	Timestamp  string      `json:"timestamp"`
	StreamID   string      `json:"stream_id,omitempty"`
}

// Hub manages WebSocket connections
type Hub interface {
	Run(ctx context.Context)
	Broadcast(msg *Message)
	Register(client *Client)
	Unregister(client *Client)
	GetClient(userID int) (*Client, bool)
	BroadcastGeneric(msg interface{})
}

// MessageHandler handles incoming messages
type MessageHandler interface {
	HandleMessage(ctx context.Context, msg *Message)
}

// hub implements the Hub interface
type hub struct {
	clients    map[int]*Client
	broadcast  chan *Message
	register   chan *Client
	unregister chan *Client
	mu         sync.RWMutex
	handlers   []MessageHandler
}

// NewHub creates a new WebSocket hub
func NewHub(handlers ...MessageHandler) Hub {
	return &hub{
		clients:    make(map[int]*Client),
		broadcast:  make(chan *Message, 100),
		register:   make(chan *Client, 10),
		unregister: make(chan *Client, 10),
		handlers:   handlers,
	}
}

// Run starts the hub's event loop
func (h *hub) Run(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		case client := <-h.register:
			h.registerClient(client)
		case client := <-h.unregister:
			h.unregisterClient(client)
		case message := <-h.broadcast:
			h.handleBroadcast(ctx, message)
		}
	}
}

func (h *hub) registerClient(client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.clients[client.UserID()] = client
}

func (h *hub) unregisterClient(client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if _, ok := h.clients[client.UserID()]; ok {
		delete(h.clients, client.UserID())
		close(client.send)
	}
}

func (h *hub) handleBroadcast(ctx context.Context, message *Message) {
	// Notify handlers
	for _, handler := range h.handlers {
		go handler.HandleMessage(ctx, message)
	}

	// Route message
	if message.TargetID != 0 {
		h.routeToTarget(message)
	} else {
		h.broadcastToAll(message)
	}
}

func (h *hub) routeToTarget(message *Message) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	// Send to target
	if target, ok := h.clients[message.TargetID]; ok {
		select {
		case target.send <- message:
		default:
			go h.Unregister(target)
		}
	}

	// Echo back to sender for chat messages
	if message.Type == MessageTypeChat || message.Type == MessageTypeChatStream || message.Type == MessageTypeChatStreamEnd {
		if sender, ok := h.clients[message.SenderID]; ok && message.SenderID != message.TargetID {
			select {
			case sender.send <- message:
			default:
				go h.Unregister(sender)
			}
		}
	}
}

func (h *hub) broadcastToAll(message *Message) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	for _, client := range h.clients {
		select {
		case client.send <- message:
		default:
			go h.Unregister(client)
		}
	}
}

// Broadcast sends a message to the hub
func (h *hub) Broadcast(msg *Message) {
	select {
	case h.broadcast <- msg:
	default:
		// Channel full, drop message
	}
}

// Register registers a client with the hub
func (h *hub) Register(client *Client) {
	h.register <- client
}

// Unregister unregisters a client from the hub
func (h *hub) Unregister(client *Client) {
	h.unregister <- client
}

// GetClient retrieves a client by user ID
func (h *hub) GetClient(userID int) (*Client, bool) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	client, ok := h.clients[userID]
	return client, ok
}

// BroadcastGeneric broadcasts a generic message (for compatibility with butler package)
func (h *hub) BroadcastGeneric(msg interface{}) {
	// Try to convert to *Message
	if m, ok := msg.(*Message); ok {
		h.Broadcast(m)
		return
	}

	// Try to convert map to Message
	if data, ok := msg.(map[string]interface{}); ok {
		m := &Message{
			Timestamp: time.Now().Format(time.RFC3339),
		}
		if t, ok := data["type"].(string); ok {
			m.Type = MessageType(t)
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
		if payload, ok := data["payload"]; ok {
			m.Payload = payload
		}
		h.Broadcast(m)
	}
}

// Client represents a WebSocket client
type Client struct {
	hub      Hub
	conn     *websocket.Conn
	send     chan *Message
	userID   int
	username string
	role     string
	mu       sync.RWMutex
}

// ClientConfig holds client configuration
type ClientConfig struct {
	Hub      Hub
	Conn     *websocket.Conn
	UserID   int
	Username string
	Role     string
}

// NewClient creates a new WebSocket client
func NewClient(cfg *ClientConfig) *Client {
	return &Client{
		hub:      cfg.Hub,
		conn:     cfg.Conn,
		send:     make(chan *Message, sendBufferSize),
		userID:   cfg.UserID,
		username: cfg.Username,
		role:     cfg.Role,
	}
}

// UserID returns the client's user ID
func (c *Client) UserID() int {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.userID
}

// Username returns the client's username
func (c *Client) Username() string {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.username
}

// Role returns the client's role
func (c *Client) Role() string {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.role
}

// ReadPump pumps messages from the WebSocket connection to the hub
func (c *Client) ReadPump() {
	defer func() {
		c.hub.Unregister(c)
		c.conn.Close()
	}()

	c.conn.SetReadLimit(maxMessageSize)
	c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		var msg Message
		err := c.conn.ReadJSON(&msg)
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				// Log unexpected close error
			}
			break
		}

		msg.SenderID = c.UserID()
		msg.SenderName = c.Username()
		msg.SenderRole = c.Role()
		msg.Timestamp = time.Now().Format(time.RFC3339)

		c.hub.Broadcast(&msg)
	}
}

// WritePump pumps messages from the hub to the WebSocket connection
func (c *Client) WritePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			if err := c.conn.WriteJSON(message); err != nil {
				return
			}

		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// UpgraderConfig holds WebSocket upgrader configuration
type UpgraderConfig struct {
	ReadBufferSize  int
	WriteBufferSize int
	CheckOrigin     func(r *http.Request) bool
}

// DefaultUpgraderConfig returns default upgrader configuration
func DefaultUpgraderConfig() *UpgraderConfig {
	return &UpgraderConfig{
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
		CheckOrigin:     func(r *http.Request) bool { return true },
	}
}

// NewUpgrader creates a new WebSocket upgrader
func NewUpgrader(cfg *UpgraderConfig) *websocket.Upgrader {
	return &websocket.Upgrader{
		ReadBufferSize:  cfg.ReadBufferSize,
		WriteBufferSize: cfg.WriteBufferSize,
		CheckOrigin:     cfg.CheckOrigin,
	}
}

// ServeWS handles WebSocket requests
func ServeWS(w http.ResponseWriter, r *http.Request, hub Hub, upgrader *websocket.Upgrader, userID int, username, role string) error {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return apperrors.Wrap(apperrors.ErrInternal, "failed to upgrade connection", err)
	}

	client := NewClient(&ClientConfig{
		Hub:      hub,
		Conn:     conn,
		UserID:   userID,
		Username: username,
		Role:     role,
	})

	hub.Register(client)

	go client.WritePump()
	go client.ReadPump()

	return nil
}

// JSONString returns a JSON string representation of the message payload
func (m *Message) JSONString() (string, error) {
	if m.Payload == nil {
		return "", nil
	}

	bytes, err := json.Marshal(m.Payload)
	if err != nil {
		return "", fmt.Errorf("failed to marshal payload: %w", err)
	}

	return string(bytes), nil
}

// ParsePayload parses the payload into the given struct
func (m *Message) ParsePayload(v interface{}) error {
	if m.Payload == nil {
		return nil
	}

	bytes, err := json.Marshal(m.Payload)
	if err != nil {
		return fmt.Errorf("failed to marshal payload: %w", err)
	}

	if err := json.Unmarshal(bytes, v); err != nil {
		return fmt.Errorf("failed to unmarshal payload: %w", err)
	}

	return nil
}
