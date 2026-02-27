package butler

import (
	"context"
	"fmt"
	"log"
	"os"
	"sync"

	"github.com/google/uuid"
	"github.com/lea/echocenter/backend/internal/models"
	"github.com/lea/echocenter/backend/internal/repository"
)

// HubInterface defines the interface for WebSocket hub
type HubInterface interface {
	BroadcastGeneric(msg interface{})
}

// Service defines the butler service interface
type Service interface {
	GetButlerID() int
	ProcessLog(ctx context.Context, msg models.Message)
	RequestAuthorization(actionID string, targetID int, command, reasoning string)
	HandleUserMessage(ctx context.Context, senderID int, payload string)
}

// ButlerService implements the Service interface
type ButlerService struct {
	butlerID   int
	butlerName string
	baseURL    string
	apiToken   string
	model      string
	mu         sync.RWMutex
	brain      *EinoBrain
	hub        HubInterface
	repo       repository.Repository
}

var (
	instance *ButlerService
	once     sync.Once
)

// InitButler initializes the Butler singleton
func InitButler(id int, name string, hub HubInterface, repo repository.Repository) {
	once.Do(func() {
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
			repo:       repo,
		}
		log.Printf("Butler service initialized for agent: %s (ID: %d)", name, id)
		if baseURL != "" {
			log.Printf("Butler brain connected to: %s", baseURL)
		}
	})
}

// GetButler returns the singleton instance
func GetButler() *ButlerService {
	return instance
}

// GetButlerID returns the butler's user ID
func (s *ButlerService) GetButlerID() int {
	return s.butlerID
}

// ProcessLog processes log messages for situational awareness
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

// RequestAuthorization emits an AUTH_REQUEST WebSocket frame
func (s *ButlerService) RequestAuthorization(actionID string, targetID int, command, reasoning string) {
	if s.hub == nil {
		return
	}

	targetName := "Unknown Agent"
	agents, err := s.repo.GetAgents(context.Background())
	if err == nil {
		for _, a := range agents {
			if a.ID == targetID {
				targetName = a.Username
				break
			}
		}
	}

	msg := map[string]interface{}{
		"type":        "AUTH_REQUEST",
		"sender_id":   s.butlerID,
		"sender_role": "BUTLER",
		"payload": map[string]interface{}{
			"action_id":         actionID,
			"target_agent_id":   targetID,
			"target_agent_name": targetName,
			"command":           command,
			"reason":            reasoning,
		},
	}

	s.hub.BroadcastGeneric(msg)
}

// HandleUserMessage processes direct instructions to the butler
func (s *ButlerService) HandleUserMessage(ctx context.Context, senderID int, payload string) {
	if s.brain == nil {
		return
	}

	sessionID := fmt.Sprintf("user_%d", senderID)
	streamID := uuid.New().String()

	agents, err := s.repo.GetAgents(ctx)
	systemState := "Active Agents in the hive (excluding myself):\n"
	if err == nil {
		for _, a := range agents {
			if a.ID == s.butlerID {
				continue
			}
			systemState += fmt.Sprintf("- %s (ID: %d, Role: %s)\n", a.Username, a.ID, a.Role)
		}
	} else {
		systemState = "System error: Unable to retrieve agent list."
	}

	fullReply, err := s.brain.ChatStream(ctx, sessionID, payload, systemState, func(chunk string) error {
		msg := map[string]interface{}{
			"type":        "CHAT_STREAM",
			"sender_id":   s.butlerID,
			"sender_name": s.butlerName,
			"sender_role": "BUTLER",
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

	err = s.repo.SaveChatMessage(ctx, &models.ChatMessage{
		SenderID:   s.butlerID,
		ReceiverID: senderID,
		Payload:    fullReply,
	})
	if err != nil {
		log.Printf("[Butler] Failed to persist chat: %v", err)
	}

	s.hub.BroadcastGeneric(map[string]interface{}{
		"type":        "CHAT_STREAM_END",
		"sender_id":   s.butlerID,
		"sender_name": s.butlerName,
		"sender_role": "BUTLER",
		"target_id":   senderID,
		"payload":     "",
		"stream_id":   streamID,
	})
}
