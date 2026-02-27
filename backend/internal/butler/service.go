package butler

import (
	"context"
	"fmt"
	"log"
	"os"
	"sync"

	"github.com/google/uuid"
	"github.com/lea/echocenter/backend/internal/database"
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

	sessionID := fmt.Sprintf("user_%d", senderID)
	streamID := uuid.New().String()

	// 1. Fetch current system state (Agents list)
	agents, err := database.GetAgents()
	systemState := "Active Agents in the hive (excluding myself):\n"
	if err == nil {
		for _, a := range agents {
			if a.ID == s.butlerID {
				continue // Don't list myself as a managed agent
			}
			systemState += fmt.Sprintf("- %s (ID: %d, Role: %s)\n", a.Username, a.ID, a.Role)
		}
	} else {
		systemState = "System error: Unable to retrieve agent list."
	}

	// 2. Chat with stream and awareness
	fullReply, err := s.brain.ChatStream(ctx, sessionID, payload, systemState, func(chunk string) error {
		msg := map[string]interface{}{
			"type":        "CHAT_STREAM",
			"sender_id":   s.butlerID,
			"sender_name": s.butlerName,
			"target_id":   senderID,
			"payload":     chunk,
			"stream_id":   streamID,
		}
		s.hub.BroadcastGeneric(msg)
		return nil
	})

	if err != nil {
		log.Printf("[Butler] Error in chat reasoning: %v", err)
		return
	}

	// Persist the complete message to DB
	err = database.SaveChatMessage(s.butlerID, senderID, fullReply)
	if err != nil {
		log.Printf("[Butler] Failed to persist chat: %v", err)
	}

	// Final message to signal completion
	msg := map[string]interface{}{
		"type":        "CHAT_STREAM_END",
		"sender_id":   s.butlerID,
		"sender_name": s.butlerName,
		"target_id":   senderID,
		"payload":     "",
		"stream_id":   streamID,
	}
	s.hub.BroadcastGeneric(msg)
}
