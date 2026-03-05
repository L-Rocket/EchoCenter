package repository

import (
	"context"
	"time"

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

// IntegrationRepository manages external channel connector configurations.
type IntegrationRepository interface {
	GetFeishuConnector(ctx context.Context) (*models.FeishuConnector, error)
	CreateFeishuConnector(ctx context.Context, connector *models.FeishuConnector) error
	UpdateFeishuConnector(ctx context.Context, connector *models.FeishuConnector) error
	SetFeishuConnectorEnabled(ctx context.Context, id int, enabled bool) (*models.FeishuConnector, error)
	MarkFeishuConnectorVerified(ctx context.Context, id int, verifiedAt time.Time) (*models.FeishuConnector, error)
	AppendFeishuIntegrationLog(ctx context.Context, connectorID int, level, action, detail string) error
	ListFeishuIntegrationLogs(ctx context.Context, connectorID int, cursor string, limit int) ([]models.IntegrationLog, string, error)
	RegisterFeishuInboundMessage(ctx context.Context, connectorID int, messageID, chatID, feishuUserID, rawPayload string) (bool, error)
	GetLatestFeishuInboundTarget(ctx context.Context, connectorID int) (chatID string, feishuUserID string, err error)
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
	IntegrationRepository
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
