package butler

import (
	"context"
	"log"
	"os"
	"sync"

	"github.com/lea/echocenter/backend/internal/models"
)

// HubInterface to avoid circular dependency
type HubInterface interface {
	BroadcastGeneric(msg interface{})
}

type ButlerService struct {
	butlerID   int
	butlerName string
	baseURL    string
	apiToken   string
	model      string
	mu         sync.RWMutex
	brain      *EinoBrain
	hub        HubInterface
}

var (
	instance *ButlerService
	once     sync.Once
)

// InitButler initializes the Butler singleton (T006)
func InitButler(id int, name string, hub HubInterface) {
	once.Do(func() {
		// Load from System Environment or .env
		baseURL := os.Getenv("BUTLER_BASE_URL")
		apiToken := os.Getenv("BUTLER_API_TOKEN")
		model := os.Getenv("BUTLER_MODEL")

		if apiToken == "" {
			log.Println("WARNING: BUTLER_API_TOKEN not found in environment.")
		}

		instance = &ButlerService{
			butlerID:   id,
			butlerName: name,
			baseURL:    baseURL,
			apiToken:   apiToken,
			model:      model,
			brain:      NewEinoBrain(baseURL, apiToken, model),
			hub:        hub,
		}
		log.Printf("Butler service initialized for agent: %s (ID: %d)", name, id)
		if baseURL != "" {
			log.Printf("Butler brain connected to: %s", baseURL)
		}
	})
}

func GetButler() *ButlerService {
	return instance
}

func (s *ButlerService) GetButlerID() int {
	return s.butlerID
}

// ProcessLog entry point for situational awareness (US1)
func (s *ButlerService) ProcessLog(ctx context.Context, msg models.Message) {
	if s.brain == nil {
		return
	}
	
	thought, err := s.brain.ObserveLog(ctx, msg)
	if err != nil {
		log.Printf("[Butler] Brain error processing log: %v", err)
		return
	}
	
	log.Printf("[Butler] Thought: %s", thought)
}

// RequestAuthorization emits an AUTH_REQUEST WebSocket frame (T013)
func (s *ButlerService) RequestAuthorization(actionID string, targetID int, command, reasoning string) {
	if s.hub == nil {
		return
	}

	// We need to fetch target agent name
	targetName := "Unknown Agent"
	// For simplicity, we skip name lookup here or assume frontend handles it.
	
	// Create a generic message that the Hub can understand
	// We'll use a map to simulate the Message struct without importing websocket
	msg := map[string]interface{}{
		"type":      "AUTH_REQUEST",
		"sender_id": s.butlerID,
		"payload": map[string]interface{}{
			"action_id":         actionID,
			"target_agent_id":   targetID,
			"target_agent_name": targetName,
			"command":           command,
			"reason":            reasoning,
		},
	}
	
	// Since BroadcastGeneric expects *websocket.Message, we need a way to wrap it.
	// Actually, I'll update hub.go to wrap it if it's not already a *Message.
	s.hub.BroadcastGeneric(msg)
}

// HandleUserMessage processes direct instructions to the butler
func (s *ButlerService) HandleUserMessage(ctx context.Context, senderID int, payload string) {
	if s.brain == nil {
		return
	}

	reply, err := s.brain.Chat(ctx, payload)
	if err != nil {
		log.Printf("[Butler] Error in chat reasoning: %v", err)
		return
	}

	// Send reply back to the user who messaged us
	msg := map[string]interface{}{
		"type":        "CHAT",
		"sender_id":   s.butlerID,
		"sender_name": s.butlerName,
		"target_id":   senderID,
		"payload":     reply,
	}
	s.hub.BroadcastGeneric(msg)
}
