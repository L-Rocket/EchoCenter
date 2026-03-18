package butler

import (
	"context"
	"encoding/json"
	"log"
	"os"
	"strconv"
	"strings"
	"sync"

	"github.com/lea/echocenter/backend/internal/models"
	"github.com/lea/echocenter/backend/internal/repository"
)

// HubInterface defines the interface for WebSocket hub
type HubInterface interface {
	BroadcastGeneric(msg any)
	HasClient(userID int) bool
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
		compactionCfg := loadContextCompactionConfig(baseURL, apiToken, model)

		if apiToken == "" {
			log.Println("WARNING: BUTLER_API_TOKEN not found in environment.")
		}

		instance = &ButlerService{
			butlerID:   id,
			butlerName: name,
			baseURL:    baseURL,
			apiToken:   apiToken,
			model:      model,
			brain:      NewEinoBrain(baseURL, apiToken, model, compactionCfg),
			hub:        hub,
			repo:       repo,
		}

		log.Printf("Butler service initialized for agent: %s (ID: %d)", name, id)
		if baseURL != "" {
			log.Printf("Butler brain connected to: %s", baseURL)
		}
	})
}

func loadContextCompactionConfig(baseURL, apiToken, model string) ContextCompactionConfig {
	cfg := newContextCompactionConfig(baseURL, apiToken, model)

	if raw, ok := os.LookupEnv("BUTLER_CONTEXT_COMPACTION_ENABLED"); ok {
		cfg.Enabled = parseBoolOrDefault(raw, cfg.Enabled)
	}
	if raw := strings.TrimSpace(os.Getenv("BUTLER_CONTEXT_COMPACTION_BASE_URL")); raw != "" {
		cfg.BaseURL = raw
	}
	if raw := strings.TrimSpace(os.Getenv("BUTLER_CONTEXT_COMPACTION_API_TOKEN")); raw != "" {
		cfg.APIToken = raw
	}
	if raw := strings.TrimSpace(os.Getenv("BUTLER_CONTEXT_COMPACTION_MODEL")); raw != "" {
		cfg.Model = raw
	}
	if raw, ok := os.LookupEnv("BUTLER_CONTEXT_COMPACTION_TRIGGER_MESSAGES"); ok {
		cfg.TriggerMessages = parseIntOrDefault(raw, cfg.TriggerMessages)
	}
	if raw, ok := os.LookupEnv("BUTLER_CONTEXT_COMPACTION_TRIGGER_CHARS"); ok {
		cfg.TriggerChars = parseIntOrDefault(raw, cfg.TriggerChars)
	}
	if raw, ok := os.LookupEnv("BUTLER_CONTEXT_COMPACTION_RECENT_WINDOW"); ok {
		cfg.RecentWindow = parseIntOrDefault(raw, cfg.RecentWindow)
	}

	return cfg.withDefaults()
}

func parseBoolOrDefault(raw string, fallback bool) bool {
	parsed, err := strconv.ParseBool(strings.TrimSpace(raw))
	if err != nil {
		return fallback
	}
	return parsed
}

func parseIntOrDefault(raw string, fallback int) int {
	parsed, err := strconv.Atoi(strings.TrimSpace(raw))
	if err != nil {
		return fallback
	}
	return parsed
}

// GetButler returns the singleton instance
func GetButler() *ButlerService {
	return instance
}

// SetHub updates the hub reference (used after WebSocket hub is created)
func (s *ButlerService) SetHub(hub HubInterface) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.hub = hub
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
	payloadMap := map[string]any{
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
		msg := map[string]any{
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

// HandleUserMessage processes direct instructions to the butler
func (s *ButlerService) HandleUserMessage(ctx context.Context, senderID int, payload string) {
	s.handleUserMessageFlow(ctx, senderID, payload)
}

// ExecutePendingCommand executes a pending command after user approval
func (s *ButlerService) ExecutePendingCommand(ctx context.Context, streamID string, senderID int, approved bool) {
	// First, try to resolve as a tool execution (ReAct Agent flow)
	if ResolveAction(streamID, approved) {
		log.Printf("[Butler] Resolved action %s as tool execution (ReAct Agent flow)", streamID)
		// Update database status
		status := "REJECTED"
		if approved {
			status = "APPROVED"
		}
		_ = s.repo.UpdateAuthRequestStatus(ctx, streamID, status)
		return
	}

	log.Printf("[Butler] No pending ReAct action found for streamID: %s", streamID)
}
