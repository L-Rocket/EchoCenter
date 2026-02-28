package butler

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strconv"
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
		// Set global service for command execution
		SetGlobalService(instance)
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
	ctx := context.Background()

	targetName := "Unknown Agent"
	agents, err := s.repo.GetAgents(ctx)
	if err == nil {
		for _, a := range agents {
			if a.ID == targetID {
				targetName = a.Username
				break
			}
		}
	}

	// Persist AUTH_REQUEST to database
	payloadMap := map[string]interface{}{
		"action_id":         actionID,
		"target_agent_id":   targetID,
		"target_agent_name": targetName,
		"command":           command,
		"reason":            reasoning,
		"status":            "PENDING",
	}
	payloadBytes, _ := json.Marshal(payloadMap)

	// Find admin user (target of the auth request)
	users, _ := s.repo.GetUsers(ctx)
	var adminID int
	for _, u := range users {
		if u.Role == "ADMIN" {
			adminID = u.ID
			break
		}
	}
	if adminID == 0 {
		adminID = 1 // fallback
	}

	chatMsg := &models.ChatMessage{
		SenderID:   s.butlerID,
		ReceiverID: adminID,
		Type:       "AUTH_REQUEST",
		Payload:    string(payloadBytes),
	}

	if err := s.repo.SaveChatMessage(ctx, chatMsg); err != nil {
		log.Printf("[Butler] Failed to persist auth request: %v", err)
	}

	// Broadcast via WebSocket
	if s.hub != nil {
		msg := map[string]interface{}{
			"type":        "AUTH_REQUEST",
			"sender_id":   s.butlerID,
			"sender_name": s.butlerName,
			"sender_role": "BUTLER",
			"target_id":   adminID,
			"payload":     payloadMap,
		}
		s.hub.BroadcastGeneric(msg)
	}
}

// pendingCommands stores commands waiting for user authorization
var pendingCommands = make(map[string]*ChatStreamResult)
var pendingCommandsMu sync.RWMutex

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

	// Step 1: Stream the initial response and detect if there's a command
	result, err := s.brain.ChatStream(ctx, sessionID, payload, systemState, func(chunk string) error {
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

	// Save the initial response
	err = s.repo.SaveChatMessage(ctx, &models.ChatMessage{
		SenderID:   s.butlerID,
		ReceiverID: senderID,
		Payload:    result.Content,
	})
	if err != nil {
		log.Printf("[Butler] Failed to persist chat: %v", err)
	}

	// Step 2: If there's a command, send AUTH_REQUEST and wait for user approval
	if result.HasCommand {
		// Store the command for later execution
		pendingCommandsMu.Lock()
		pendingCommands[streamID] = result
		pendingCommandsMu.Unlock()

		// Convert agent_id to int for frontend
		var agentID int
		switch v := result.Command["target_agent_id"].(type) {
		case float64:
			agentID = int(v)
		case int:
			agentID = v
		case string:
			agentID, _ = strconv.Atoi(v)
		}

		// Send AUTH_REQUEST to user
		authPayload := map[string]interface{}{
			"action_id":         streamID,
			"target_agent_name": fmt.Sprintf("Agent %d", agentID),
			"command":           result.Command["command"],
			"reason":            result.Command["reasoning"],
			"status":            "PENDING",
		}

		s.hub.BroadcastGeneric(map[string]interface{}{
			"type":        "AUTH_REQUEST",
			"sender_id":   s.butlerID,
			"sender_name": s.butlerName,
			"sender_role": "BUTLER",
			"target_id":   senderID,
			"payload":     authPayload,
		})

		// Send CHAT_STREAM_END to stop the processing indicator
		s.hub.BroadcastGeneric(map[string]interface{}{
			"type":        "CHAT_STREAM_END",
			"sender_id":   s.butlerID,
			"sender_name": s.butlerName,
			"sender_role": "BUTLER",
			"target_id":   senderID,
			"payload":     "",
			"stream_id":   streamID,
		})

		return
	}

	// No command, end the stream normally
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

// ExecutePendingCommand executes a pending command after user approval
func (s *ButlerService) ExecutePendingCommand(ctx context.Context, streamID string, senderID int, approved bool) {
	pendingCommandsMu.Lock()
	result, exists := pendingCommands[streamID]
	if exists {
		delete(pendingCommands, streamID)
	}
	pendingCommandsMu.Unlock()

	if !exists {
		log.Printf("[Butler] No pending command found for streamID: %s", streamID)
		return
	}

	if !approved {
		// User rejected the command
		s.hub.BroadcastGeneric(map[string]interface{}{
			"type":        "CHAT",
			"sender_id":   s.butlerID,
			"sender_name": s.butlerName,
			"sender_role": "BUTLER",
			"target_id":   senderID,
			"payload":     "Command cancelled by user.",
		})
		s.hub.BroadcastGeneric(map[string]interface{}{
			"type":        "CHAT_STREAM_END",
			"sender_id":   s.butlerID,
			"sender_name": s.butlerName,
			"sender_role": "BUTLER",
			"target_id":   senderID,
			"payload":     "",
			"stream_id":   streamID,
		})
		return
	}

	// Execute the command and stream the result
	_, err := s.brain.ExecuteCommand(ctx, result, func(chunk string) error {
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
		log.Printf("[Butler] Error executing command: %v", err)
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
