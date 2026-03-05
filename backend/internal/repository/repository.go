package repository

import (
	"context"

	"github.com/lea/echocenter/backend/internal/models"
)

// MessageRepository manages dashboard message storage.
type MessageRepository interface {
	CreateMessage(ctx context.Context, msg *models.Message) error
	GetMessages(ctx context.Context, filter MessageFilter) ([]models.Message, error)
}

// UserRepository manages users and agents.
type UserRepository interface {
	CreateUser(ctx context.Context, user *models.User) error
	GetUserByUsername(ctx context.Context, username string) (*models.User, error)
	GetUserByID(ctx context.Context, id int) (*models.User, error)
	GetUsers(ctx context.Context) ([]models.User, error)
	GetAgentByToken(ctx context.Context, token string) (*models.User, error)
	GetAgents(ctx context.Context) ([]models.User, error)
	CreateAgent(ctx context.Context, username, token string) error
	UpdateAgentToken(ctx context.Context, agentID int, token string) error
}

// ChatRepository manages direct chat persistence.
type ChatRepository interface {
	SaveChatMessage(ctx context.Context, msg *models.ChatMessage) error
	GetChatHistory(ctx context.Context, user1ID, user2ID int, limit int) ([]models.ChatMessage, error)
	UpdateAuthRequestStatus(ctx context.Context, actionID string, status string) error
}

// ButlerRepository manages Butler authorization records.
type ButlerRepository interface {
	SaveAuthorization(ctx context.Context, auth *models.ButlerAuthorization) error
	UpdateAuthorizationStatus(ctx context.Context, id string, status string) error
	GetAuthorization(ctx context.Context, id string) (*models.ButlerAuthorization, error)
}

// BootstrapRepository manages startup/bootstrap data preparation.
type BootstrapRepository interface {
	InitializeAdmin(ctx context.Context, username, password string, bcryptCost int) error
	InitializeButler(ctx context.Context) (*models.User, error)
}

// MaintenanceRepository exposes maintenance operations.
type MaintenanceRepository interface {
	ResetMockData(ctx context.Context) error
	Close() error
}

// Repository defines the full data-access contract used by the application.
type Repository interface {
	MessageRepository
	UserRepository
	ChatRepository
	ButlerRepository
	BootstrapRepository
	MaintenanceRepository
}

// MessageFilter defines filter parameters for messages.
type MessageFilter struct {
	AgentID string
	Level   string
	Query   string
	Offset  int
	Limit   int
}
