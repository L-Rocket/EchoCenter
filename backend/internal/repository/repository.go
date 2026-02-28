package repository

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/lea/echocenter/backend/internal/config"
	"github.com/lea/echocenter/backend/internal/models"
	apperrors "github.com/lea/echocenter/backend/pkg/errors"
	_ "modernc.org/sqlite"
)

// Repository defines the interface for data access
// This is the main interface that services should depend on
type Repository interface {
	MessageRepository
	UserRepository
	ChatRepository
	AuthorizationRepository
	AdminRepository
	Close() error
}

// MessageRepository handles message/dashboard operations
type MessageRepository interface {
	CreateMessage(ctx context.Context, msg *models.Message) error
	GetMessages(ctx context.Context, filter MessageFilter) ([]models.Message, error)
}

// MessageFilter defines filter parameters for messages
type MessageFilter struct {
	AgentID string
	Level   string
	Query   string
	Offset  int
	Limit   int
}

// UserRepository handles user and agent operations
type UserRepository interface {
	CreateUser(ctx context.Context, user *models.User) error
	GetUserByUsername(ctx context.Context, username string) (*models.User, error)
	GetUserByID(ctx context.Context, id int) (*models.User, error)
	GetUsers(ctx context.Context) ([]models.User, error)
	GetAgentByToken(ctx context.Context, token string) (*models.User, error)
	GetAgents(ctx context.Context) ([]models.User, error)
	CreateAgent(ctx context.Context, username, token string) error
}

// ChatRepository handles chat message operations
type ChatRepository interface {
	SaveChatMessage(ctx context.Context, msg *models.ChatMessage) error
	GetChatHistory(ctx context.Context, user1ID, user2ID int, limit int) ([]models.ChatMessage, error)
}

// AuthorizationRepository handles butler authorization operations
type AuthorizationRepository interface {
	SaveAuthorization(ctx context.Context, auth *models.ButlerAuthorization) error
	UpdateAuthorizationStatus(ctx context.Context, id string, status string) error
	GetAuthorization(ctx context.Context, id string) (*models.ButlerAuthorization, error)
}

// AdminRepository handles admin initialization operations
type AdminRepository interface {
	InitializeAdmin(ctx context.Context, username, password string, bcryptCost int) error
}

// sqliteRepository implements Repository using SQLite
type sqliteRepository struct {
	db *sql.DB
}

// New creates a new repository instance
func New(cfg *config.DatabaseConfig) (Repository, error) {
	// Add busy timeout and journal mode parameters to avoid SQLITE_BUSY errors
	dsn := cfg.Path + "?_busy_timeout=5000&_journal_mode=WAL"
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, apperrors.Wrap(apperrors.ErrDatabase, "failed to open database", err)
	}

	// Configure connection pool - SQLite works best with single connection
	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)
	db.SetConnMaxLifetime(cfg.ConnMaxLifetime)

	// Test connection
	if err := db.Ping(); err != nil {
		return nil, apperrors.Wrap(apperrors.ErrDatabase, "failed to ping database", err)
	}

	repo := &sqliteRepository{db: db}

	if err := repo.migrate(); err != nil {
		return nil, err
	}

	return repo, nil
}

// migrate creates database tables and indexes
func (r *sqliteRepository) migrate() error {
	migrations := []struct {
		name string
		sql  string
	}{
		{
			name: "create_messages_table",
			sql: `CREATE TABLE IF NOT EXISTS messages (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				agent_id TEXT NOT NULL,
				level TEXT NOT NULL,
				content TEXT NOT NULL,
				timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
			);`,
		},
		{
			name: "create_users_table",
			sql: `CREATE TABLE IF NOT EXISTS users (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				username TEXT NOT NULL UNIQUE,
				password_hash TEXT NOT NULL,
				api_token TEXT UNIQUE,
				role TEXT NOT NULL DEFAULT 'MEMBER',
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP
			);`,
		},
		{
			name: "create_chat_messages_table",
			sql: `CREATE TABLE IF NOT EXISTS chat_messages (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				sender_id INTEGER NOT NULL,
				receiver_id INTEGER NOT NULL,
				type TEXT DEFAULT 'CHAT',
				content TEXT NOT NULL,
				timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
				FOREIGN KEY(sender_id) REFERENCES users(id),
				FOREIGN KEY(receiver_id) REFERENCES users(id)
			);`,
		},
		{
			name: "create_butler_authorizations_table",
			sql: `CREATE TABLE IF NOT EXISTS butler_authorizations (
				id TEXT PRIMARY KEY,
				target_agent_id INTEGER NOT NULL,
				proposed_command TEXT NOT NULL,
				reasoning TEXT NOT NULL,
				status TEXT NOT NULL DEFAULT 'PENDING',
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
				responded_at DATETIME,
				FOREIGN KEY(target_agent_id) REFERENCES users(id)
			);`,
		},
		{
			name: "create_indexes",
			sql: `CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages (timestamp DESC, id DESC);
				CREATE INDEX IF NOT EXISTS idx_chat_pair_time ON chat_messages (sender_id, receiver_id, timestamp DESC);
				CREATE INDEX IF NOT EXISTS idx_butler_status ON butler_authorizations (status);`,
		},
	}

	for _, m := range migrations {
		if _, err := r.db.Exec(m.sql); err != nil {
			return apperrors.Wrap(apperrors.ErrDatabase, fmt.Sprintf("failed to run migration: %s", m.name), err)
		}
	}

	return nil
}

// Close closes the database connection
func (r *sqliteRepository) Close() error {
	if r.db != nil {
		return r.db.Close()
	}
	return nil
}

// isUniqueConstraintError checks if an error is a unique constraint violation
func isUniqueConstraintError(err error) bool {
	if err == nil {
		return false
	}
	// SQLite unique constraint error contains "UNIQUE constraint failed"
	return err.Error() != "" && len(err.Error()) > 0 &&
		(err.Error()[0:5] == "UNIQUE" || err.Error()[0:5] == "uniqu")
}
