package butler

import (
	"context"
	"log"

	"github.com/lea/echocenter/backend/internal/api/websocket"
)

// MessageHandler handles WebSocket messages for the Butler
type MessageHandler struct{}

// NewMessageHandler creates a new Butler message handler
func NewMessageHandler() *MessageHandler {
	return &MessageHandler{}
}

// HandleMessage processes incoming WebSocket messages
func (h *MessageHandler) HandleMessage(ctx context.Context, msg *websocket.Message) {
	if msg == nil {
		return
	}

	b := GetButler()
	if b == nil {
		return
	}

	switch msg.Type {
	case websocket.MessageTypeChat:
		if msg.TargetID == b.GetButlerID() && msg.SenderID != b.GetButlerID() {
			payload, ok := msg.Payload.(string)
			if !ok {
				return
			}
			log.Printf("[Butler Handler] Received chat from user %d: %s", msg.SenderID, payload)
			go b.HandleUserMessage(ctx, msg.SenderID, payload)
		}

	case websocket.MessageTypeSystemLog:
	}
}
