package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgconn"
	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/lea/echocenter/backend/internal/config"
	"github.com/lea/echocenter/backend/internal/models"
	apperrors "github.com/lea/echocenter/backend/pkg/errors"
	"golang.org/x/crypto/bcrypt"
	_ "modernc.org/sqlite"
)

// Repository defines the interface for data access
type Repository interface {
	// Messages
	CreateMessage(ctx context.Context, msg *models.Message) error
	GetMessages(ctx context.Context, filter MessageFilter) ([]models.Message, error)

	// Users
	CreateUser(ctx context.Context, user *models.User) error
	GetUserByUsername(ctx context.Context, username string) (*models.User, error)
	GetUserByID(ctx context.Context, id int) (*models.User, error)
	GetUsers(ctx context.Context) ([]models.User, error)
	GetAgentByToken(ctx context.Context, token string) (*models.User, error)
	GetAgents(ctx context.Context) ([]models.User, error)
	CreateAgent(ctx context.Context, username, token string) error

	// Chat
	SaveChatMessage(ctx context.Context, msg *models.ChatMessage) error
	GetChatHistory(ctx context.Context, user1ID, user2ID int, limit int) ([]models.ChatMessage, error)
	UpdateAuthRequestStatus(ctx context.Context, actionID string, status string) error

	// Butler
	SaveAuthorization(ctx context.Context, auth *models.ButlerAuthorization) error
	UpdateAuthorizationStatus(ctx context.Context, id string, status string) error
	GetAuthorization(ctx context.Context, id string) (*models.ButlerAuthorization, error)

	// Admin
	InitializeAdmin(ctx context.Context, username, password string, bcryptCost int) error
	InitializeButler(ctx context.Context) (*models.User, error)

	// Close
	Close() error
}

// MessageFilter defines filter parameters for messages
type MessageFilter struct {
	AgentID string
	Level   string
	Query   string
	Offset  int
	Limit   int
}

const (
	driverPostgres = "postgres"
	driverSQLite   = "sqlite"
)

type schemaMigration struct {
	name       string
	statements []string
}

// sqlRepository implements Repository with pluggable SQL drivers.
type sqlRepository struct {
	db     *sql.DB
	driver string
}

// New creates a new repository instance
func New(cfg *config.DatabaseConfig) (Repository, error) {
	driver := strings.ToLower(strings.TrimSpace(cfg.Driver))
	if driver == "" {
		driver = driverPostgres
	}

	var (
		db  *sql.DB
		err error
	)

	switch driver {
	case driverPostgres, "postgresql":
		driver = driverPostgres
		db, err = sql.Open("pgx", cfg.DSN)
		if err != nil {
			return nil, apperrors.Wrap(apperrors.ErrDatabase, "failed to open postgres database", err)
		}
	case driverSQLite:
		// Ensure the directory for the database exists
		dbDir := filepath.Dir(cfg.Path)
		if err := os.MkdirAll(dbDir, 0755); err != nil {
			return nil, apperrors.Wrap(apperrors.ErrInternal, "failed to create database directory", err)
		}

		// Add busy timeout and journal mode parameters to avoid SQLITE_BUSY errors
		dsn := cfg.Path + "?_busy_timeout=5000&_journal_mode=WAL"
		db, err = sql.Open("sqlite", dsn)
		if err != nil {
			return nil, apperrors.Wrap(apperrors.ErrDatabase, "failed to open sqlite database", err)
		}
	default:
		return nil, apperrors.New(apperrors.ErrInternal, fmt.Sprintf("unsupported DB_DRIVER: %s", cfg.Driver))
	}

	// Configure connection pool
	db.SetMaxOpenConns(cfg.MaxOpenConns)
	db.SetMaxIdleConns(cfg.MaxIdleConns)
	db.SetConnMaxLifetime(cfg.ConnMaxLifetime)
	// Test connection
	if err := db.Ping(); err != nil {
		return nil, apperrors.Wrap(apperrors.ErrDatabase, "failed to ping database", err)
	}

	repo := &sqlRepository{
		db:     db,
		driver: driver,
	}

	if err := repo.migrate(); err != nil {
		return nil, err
	}

	return repo, nil
}

// migrate creates database tables and indexes with a tracking table
func (r *sqlRepository) migrate() error {
	// Create migrations table first
	_, err := r.db.Exec(`CREATE TABLE IF NOT EXISTS migrations (
		name TEXT PRIMARY KEY,
		executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);`)
	if err != nil {
		return apperrors.Wrap(apperrors.ErrDatabase, "failed to create migrations table", err)
	}

	migrations := r.getMigrations()

	for _, m := range migrations {
		// Check if migration already executed
		var exists int
		err := r.queryRow("SELECT COUNT(*) FROM migrations WHERE name = ?", m.name).Scan(&exists)
		if err != nil {
			return apperrors.Wrap(apperrors.ErrDatabase, "failed to check migration status", err)
		}

		if exists > 0 {
			continue
		}

		log.Printf("[Migration] Executing: %s", m.name)

		// Run migration in a transaction
		tx, err := r.db.Begin()
		if err != nil {
			return apperrors.Wrap(apperrors.ErrDatabase, "failed to start migration transaction", err)
		}

		for _, stmt := range m.statements {
			if _, err := r.txExec(tx, stmt); err != nil {
				_ = tx.Rollback()
				return apperrors.Wrap(apperrors.ErrDatabase, fmt.Sprintf("failed to run migration: %s", m.name), err)
			}
		}

		if _, err := r.txExec(tx, "INSERT INTO migrations (name) VALUES (?)", m.name); err != nil {
			_ = tx.Rollback()
			return apperrors.Wrap(apperrors.ErrDatabase, "failed to record migration", err)
		}

		if err := tx.Commit(); err != nil {
			return apperrors.Wrap(apperrors.ErrDatabase, "failed to commit migration transaction", err)
		}
	}

	return nil
}

func (r *sqlRepository) getMigrations() []schemaMigration {
	if r.driver == driverPostgres {
		return []schemaMigration{
			{
				name: "001_create_messages_table",
				statements: []string{
					`CREATE TABLE IF NOT EXISTS messages (
						id BIGSERIAL PRIMARY KEY,
						agent_id TEXT NOT NULL,
						level TEXT NOT NULL,
						content TEXT NOT NULL,
						timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
					)`,
				},
			},
			{
				name: "002_create_users_table",
				statements: []string{
					`CREATE TABLE IF NOT EXISTS users (
						id BIGSERIAL PRIMARY KEY,
						username TEXT NOT NULL UNIQUE,
						password_hash TEXT NOT NULL,
						api_token TEXT UNIQUE,
						role TEXT NOT NULL DEFAULT 'MEMBER',
						created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
					)`,
				},
			},
			{
				name: "003_create_chat_messages_table",
				statements: []string{
					`CREATE TABLE IF NOT EXISTS chat_messages (
						id BIGSERIAL PRIMARY KEY,
						local_id TEXT UNIQUE,
						sender_id BIGINT NOT NULL REFERENCES users(id),
						receiver_id BIGINT NOT NULL REFERENCES users(id),
						type TEXT DEFAULT 'CHAT',
						content TEXT NOT NULL,
						timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
					)`,
				},
			},
			{
				name: "004_create_butler_authorizations_table",
				statements: []string{
					`CREATE TABLE IF NOT EXISTS butler_authorizations (
						id TEXT PRIMARY KEY,
						target_agent_id BIGINT NOT NULL REFERENCES users(id),
						proposed_command TEXT NOT NULL,
						reasoning TEXT NOT NULL,
						status TEXT NOT NULL DEFAULT 'PENDING',
						created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
						responded_at TIMESTAMPTZ
					)`,
				},
			},
			{
				name: "005_create_indexes",
				statements: []string{
					`CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages (timestamp DESC, id DESC)`,
					`CREATE INDEX IF NOT EXISTS idx_chat_pair_time ON chat_messages (sender_id, receiver_id, timestamp DESC)`,
					`CREATE INDEX IF NOT EXISTS idx_butler_status ON butler_authorizations (status)`,
				},
			},
		}
	}

	return []schemaMigration{
		{
			name: "001_create_messages_table",
			statements: []string{
				`CREATE TABLE IF NOT EXISTS messages (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					agent_id TEXT NOT NULL,
					level TEXT NOT NULL,
					content TEXT NOT NULL,
					timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
				)`,
			},
		},
		{
			name: "002_create_users_table",
			statements: []string{
				`CREATE TABLE IF NOT EXISTS users (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					username TEXT NOT NULL UNIQUE,
					password_hash TEXT NOT NULL,
					api_token TEXT UNIQUE,
					role TEXT NOT NULL DEFAULT 'MEMBER',
					created_at DATETIME DEFAULT CURRENT_TIMESTAMP
				)`,
			},
		},
		{
			name: "003_create_chat_messages_table",
			statements: []string{
				`CREATE TABLE IF NOT EXISTS chat_messages (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					local_id TEXT UNIQUE,
					sender_id INTEGER NOT NULL,
					receiver_id INTEGER NOT NULL,
					type TEXT DEFAULT 'CHAT',
					content TEXT NOT NULL,
					timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
					FOREIGN KEY(sender_id) REFERENCES users(id),
					FOREIGN KEY(receiver_id) REFERENCES users(id)
				)`,
			},
		},
		{
			name: "004_create_butler_authorizations_table",
			statements: []string{
				`CREATE TABLE IF NOT EXISTS butler_authorizations (
					id TEXT PRIMARY KEY,
					target_agent_id INTEGER NOT NULL,
					proposed_command TEXT NOT NULL,
					reasoning TEXT NOT NULL,
					status TEXT NOT NULL DEFAULT 'PENDING',
					created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
					responded_at DATETIME,
					FOREIGN KEY(target_agent_id) REFERENCES users(id)
				)`,
			},
		},
		{
			name: "005_create_indexes",
			statements: []string{
				`CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages (timestamp DESC, id DESC)`,
				`CREATE INDEX IF NOT EXISTS idx_chat_pair_time ON chat_messages (sender_id, receiver_id, timestamp DESC)`,
				`CREATE INDEX IF NOT EXISTS idx_butler_status ON butler_authorizations (status)`,
			},
		},
	}
}

func (r *sqlRepository) rebind(query string) string {
	if r.driver != driverPostgres {
		return query
	}

	var b strings.Builder
	b.Grow(len(query) + 10)

	index := 1
	for i := 0; i < len(query); i++ {
		if query[i] == '?' {
			b.WriteByte('$')
			b.WriteString(strconv.Itoa(index))
			index++
			continue
		}
		b.WriteByte(query[i])
	}
	return b.String()
}

func (r *sqlRepository) execContext(ctx context.Context, query string, args ...any) (sql.Result, error) {
	return r.db.ExecContext(ctx, r.rebind(query), args...)
}

func (r *sqlRepository) queryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error) {
	return r.db.QueryContext(ctx, r.rebind(query), args...)
}

func (r *sqlRepository) queryRowContext(ctx context.Context, query string, args ...any) *sql.Row {
	return r.db.QueryRowContext(ctx, r.rebind(query), args...)
}

func (r *sqlRepository) queryRow(query string, args ...any) *sql.Row {
	return r.db.QueryRow(r.rebind(query), args...)
}

func (r *sqlRepository) txExec(tx *sql.Tx, query string, args ...any) (sql.Result, error) {
	return tx.Exec(r.rebind(query), args...)
}

func (r *sqlRepository) insertAndReturnID(ctx context.Context, baseQuery string, args ...any) (int64, error) {
	if r.driver == driverPostgres {
		var id int64
		err := r.queryRowContext(ctx, baseQuery+" RETURNING id", args...).Scan(&id)
		if err != nil {
			return 0, err
		}
		return id, nil
	}

	result, err := r.execContext(ctx, baseQuery, args...)
	if err != nil {
		return 0, err
	}
	return result.LastInsertId()
}

// CreateMessage creates a new message
func (r *sqlRepository) CreateMessage(ctx context.Context, msg *models.Message) error {
	query := `INSERT INTO messages (agent_id, level, content) VALUES (?, ?, ?)`
	id, err := r.insertAndReturnID(ctx, query, msg.AgentID, msg.Level, msg.Content)
	if err != nil {
		return apperrors.Wrap(apperrors.ErrDatabase, "failed to create message", err)
	}

	msg.ID = int(id)
	msg.Timestamp = time.Now()
	return nil
}

// GetMessages retrieves messages with filtering
func (r *sqlRepository) GetMessages(ctx context.Context, filter MessageFilter) ([]models.Message, error) {
	query := `SELECT id, agent_id, level, content, timestamp FROM messages WHERE 1=1`
	var args []any

	if filter.AgentID != "" {
		query += ` AND agent_id = ?`
		args = append(args, filter.AgentID)
	}
	if filter.Level != "" {
		query += ` AND level = ?`
		args = append(args, filter.Level)
	}
	if filter.Query != "" {
		query += ` AND LOWER(content) LIKE LOWER(?)`
		args = append(args, "%"+filter.Query+"%")
	}

	query += ` ORDER BY timestamp DESC, id DESC LIMIT ? OFFSET ?`
	args = append(args, filter.Limit, filter.Offset)

	rows, err := r.queryContext(ctx, query, args...)
	if err != nil {
		return nil, apperrors.Wrap(apperrors.ErrDatabase, "failed to query messages", err)
	}
	defer rows.Close()

	var messages []models.Message
	for rows.Next() {
		var m models.Message
		if err := rows.Scan(&m.ID, &m.AgentID, &m.Level, &m.Content, &m.Timestamp); err != nil {
			return nil, apperrors.Wrap(apperrors.ErrDatabase, "failed to scan message", err)
		}
		messages = append(messages, m)
	}

	if err := rows.Err(); err != nil {
		return nil, apperrors.Wrap(apperrors.ErrDatabase, "error iterating messages", err)
	}

	return messages, nil
}

// CreateUser creates a new user
func (r *sqlRepository) CreateUser(ctx context.Context, user *models.User) error {
	var apiToken string
	if user.Role == "AGENT" {
		apiToken = fmt.Sprintf("agent-%s-token-%d", user.Username, time.Now().Unix())
	}

	query := `INSERT INTO users (username, password_hash, api_token, role) VALUES (?, ?, ?, ?)`
	_, err := r.execContext(ctx, query, user.Username, user.PasswordHash, apiToken, user.Role)
	if err != nil {
		if isUniqueConstraintError(err) {
			return apperrors.Wrap(apperrors.ErrConflict, "username already exists", err)
		}
		return apperrors.Wrap(apperrors.ErrDatabase, "failed to create user", err)
	}
	return nil
}

// GetUserByUsername retrieves a user by username
func (r *sqlRepository) GetUserByUsername(ctx context.Context, username string) (*models.User, error) {
	var user models.User
	var apiToken sql.NullString

	query := `SELECT id, username, password_hash, api_token, role, created_at FROM users WHERE username = ?`
	err := r.queryRowContext(ctx, query, username).Scan(
		&user.ID, &user.Username, &user.PasswordHash, &apiToken, &user.Role, &user.CreatedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, apperrors.Wrap(apperrors.ErrDatabase, "failed to get user by username", err)
	}

	if apiToken.Valid {
		user.APIToken = apiToken.String
	}
	return &user, nil
}

// GetUserByID retrieves a user by ID
func (r *sqlRepository) GetUserByID(ctx context.Context, id int) (*models.User, error) {
	var user models.User
	var apiToken sql.NullString

	query := `SELECT id, username, password_hash, api_token, role, created_at FROM users WHERE id = ?`
	err := r.queryRowContext(ctx, query, id).Scan(
		&user.ID, &user.Username, &user.PasswordHash, &apiToken, &user.Role, &user.CreatedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, apperrors.Wrap(apperrors.ErrDatabase, "failed to get user by id", err)
	}

	if apiToken.Valid {
		user.APIToken = apiToken.String
	}
	return &user, nil
}

// GetAgentByToken retrieves an agent by API token
func (r *sqlRepository) GetAgentByToken(ctx context.Context, token string) (*models.User, error) {
	var user models.User

	query := `SELECT id, username, role, created_at FROM users WHERE api_token = ? AND role = 'AGENT'`
	err := r.queryRowContext(ctx, query, token).Scan(
		&user.ID, &user.Username, &user.Role, &user.CreatedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, apperrors.Wrap(apperrors.ErrDatabase, "failed to get agent by token", err)
	}

	user.APIToken = token
	return &user, nil
}

// GetAgents retrieves all agents (including Butler)
func (r *sqlRepository) GetAgents(ctx context.Context) ([]models.User, error) {
	query := `SELECT id, username, role, created_at FROM users WHERE role IN ('AGENT', 'BUTLER')`
	rows, err := r.queryContext(ctx, query)
	if err != nil {
		return nil, apperrors.Wrap(apperrors.ErrDatabase, "failed to query agents", err)
	}
	defer rows.Close()

	var agents []models.User
	for rows.Next() {
		var u models.User
		if err := rows.Scan(&u.ID, &u.Username, &u.Role, &u.CreatedAt); err != nil {
			return nil, apperrors.Wrap(apperrors.ErrDatabase, "failed to scan agent", err)
		}
		agents = append(agents, u)
	}

	if err := rows.Err(); err != nil {
		return nil, apperrors.Wrap(apperrors.ErrDatabase, "error iterating agents", err)
	}

	return agents, nil
}

// GetUsers retrieves all users
func (r *sqlRepository) GetUsers(ctx context.Context) ([]models.User, error) {
	query := `SELECT id, username, role, created_at FROM users`
	rows, err := r.queryContext(ctx, query)
	if err != nil {
		return nil, apperrors.Wrap(apperrors.ErrDatabase, "failed to query users", err)
	}
	defer rows.Close()

	var users []models.User
	for rows.Next() {
		var u models.User
		if err := rows.Scan(&u.ID, &u.Username, &u.Role, &u.CreatedAt); err != nil {
			return nil, apperrors.Wrap(apperrors.ErrDatabase, "failed to scan user", err)
		}
		users = append(users, u)
	}

	if err := rows.Err(); err != nil {
		return nil, apperrors.Wrap(apperrors.ErrDatabase, "error iterating users", err)
	}

	return users, nil
}

// CreateAgent creates a new agent
func (r *sqlRepository) CreateAgent(ctx context.Context, username, token string) error {
	query := `INSERT INTO users (username, password_hash, api_token, role) VALUES (?, ?, ?, ?)`
	_, err := r.execContext(ctx, query, username, "AGENT_TOKEN_ONLY", token, "AGENT")
	if err != nil {
		if isUniqueConstraintError(err) {
			return apperrors.Wrap(apperrors.ErrConflict, "agent username already exists", err)
		}
		return apperrors.Wrap(apperrors.ErrDatabase, "failed to create agent", err)
	}
	return nil
}

// SaveChatMessage saves a chat message
func (r *sqlRepository) SaveChatMessage(ctx context.Context, msg *models.ChatMessage) error {
	msgType := msg.Type
	if msgType == "" {
		msgType = "CHAT"
	}

	// 1. Idempotency check based on LocalID
	if msg.LocalID != "" {
		var existingID int
		var existingTime time.Time
		err := r.queryRowContext(ctx, "SELECT id, timestamp FROM chat_messages WHERE local_id = ?", msg.LocalID).Scan(&existingID, &existingTime)
		if err == nil {
			// Message already exists, just return its assigned ID and Timestamp
			msg.ID = existingID
			msg.Timestamp = existingTime
			return nil
		}
	}

	// Use high-precision timestamp
	timestamp := time.Now()

	var (
		err error
		id  int64
	)
	if msg.LocalID != "" {
		query := `INSERT INTO chat_messages (local_id, sender_id, receiver_id, type, content, timestamp) VALUES (?, ?, ?, ?, ?, ?)`
		id, err = r.insertAndReturnID(ctx, query, msg.LocalID, msg.SenderID, msg.ReceiverID, msgType, msg.Payload, timestamp)
	} else {
		query := `INSERT INTO chat_messages (sender_id, receiver_id, type, content, timestamp) VALUES (?, ?, ?, ?, ?)`
		id, err = r.insertAndReturnID(ctx, query, msg.SenderID, msg.ReceiverID, msgType, msg.Payload, timestamp)
	}

	if err != nil {
		return apperrors.Wrap(apperrors.ErrDatabase, "failed to save chat message", err)
	}

	msg.ID = int(id)
	msg.Timestamp = timestamp
	return nil
}

// GetChatHistory retrieves chat history between two users
func (r *sqlRepository) GetChatHistory(ctx context.Context, user1ID, user2ID int, limit int) ([]models.ChatMessage, error) {
	query := `
		SELECT id, local_id, sender_id, receiver_id, type, content, timestamp 
		FROM chat_messages 
		WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
		ORDER BY timestamp ASC, id ASC 
		LIMIT ?
	`
	rows, err := r.queryContext(ctx, query, user1ID, user2ID, user2ID, user1ID, limit)
	if err != nil {
		return nil, apperrors.Wrap(apperrors.ErrDatabase, "failed to query chat history", err)
	}
	defer rows.Close()

	var messages []models.ChatMessage
	for rows.Next() {
		var m models.ChatMessage
		var msgType sql.NullString
		var localID sql.NullString
		if err := rows.Scan(&m.ID, &localID, &m.SenderID, &m.ReceiverID, &msgType, &m.Payload, &m.Timestamp); err != nil {
			return nil, apperrors.Wrap(apperrors.ErrDatabase, "failed to scan chat message", err)
		}
		if msgType.Valid {
			m.Type = msgType.String
		} else {
			m.Type = "CHAT"
		}
		if localID.Valid {
			m.LocalID = localID.String
		}
		messages = append(messages, m)
	}

	if err := rows.Err(); err != nil {
		return nil, apperrors.Wrap(apperrors.ErrDatabase, "error iterating chat messages", err)
	}

	return messages, nil
}

// UpdateAuthRequestStatus updates the status of an AUTH_REQUEST message in chat history
func (r *sqlRepository) UpdateAuthRequestStatus(ctx context.Context, actionID string, status string) error {
	// Fetch all AUTH_REQUEST messages
	rows, err := r.queryContext(ctx, "SELECT id, content FROM chat_messages WHERE type = 'AUTH_REQUEST'")
	if err != nil {
		return apperrors.Wrap(apperrors.ErrDatabase, "failed to query AUTH_REQUEST message", err)
	}

	type updateOp struct {
		id      int
		content string
	}
	var updates []updateOp

	for rows.Next() {
		var id int
		var content string
		if err := rows.Scan(&id, &content); err != nil {
			continue
		}

		var payload map[string]any
		if err := json.Unmarshal([]byte(content), &payload); err != nil {
			continue
		}

		// Robust check for action_id (could be parsed as string)
		if aid, ok := payload["action_id"].(string); ok && aid == actionID {
			payload["status"] = status
			newContent, _ := json.Marshal(payload)
			updates = append(updates, updateOp{id: id, content: string(newContent)})
		}
	}
	rows.Close() // Close rows BEFORE executing updates to prevent SQLITE_BUSY

	for _, op := range updates {
		_, err = r.execContext(ctx, "UPDATE chat_messages SET content = ? WHERE id = ?", op.content, op.id)
		if err != nil {
			log.Printf("[Repository] Failed to update message %d: %v", op.id, err)
		} else {
			log.Printf("[Repository] Successfully updated AuthRequest %s to %s (MsgID: %d)", actionID, status, op.id)
		}
	}

	return nil
}

// SaveAuthorization saves a butler authorization
func (r *sqlRepository) SaveAuthorization(ctx context.Context, auth *models.ButlerAuthorization) error {
	query := `INSERT INTO butler_authorizations (id, target_agent_id, proposed_command, reasoning) VALUES (?, ?, ?, ?)`
	_, err := r.execContext(ctx, query, auth.ID, auth.TargetAgentID, auth.ProposedCommand, auth.Reasoning)
	if err != nil {
		return apperrors.Wrap(apperrors.ErrDatabase, "failed to save authorization", err)
	}
	return nil
}

// UpdateAuthorizationStatus updates the status of a butler authorization
func (r *sqlRepository) UpdateAuthorizationStatus(ctx context.Context, id string, status string) error {
	query := `UPDATE butler_authorizations SET status = ?, responded_at = CURRENT_TIMESTAMP WHERE id = ?`
	result, err := r.execContext(ctx, query, status, id)
	if err != nil {
		return apperrors.Wrap(apperrors.ErrDatabase, "failed to update authorization status", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return apperrors.Wrap(apperrors.ErrDatabase, "failed to get rows affected", err)
	}

	if rowsAffected == 0 {
		return apperrors.New(apperrors.ErrNotFound, "authorization not found")
	}

	return nil
}

// GetAuthorization retrieves a butler authorization by ID
func (r *sqlRepository) GetAuthorization(ctx context.Context, id string) (*models.ButlerAuthorization, error) {
	var auth models.ButlerAuthorization
	var respondedAt sql.NullTime

	query := `SELECT id, target_agent_id, proposed_command, reasoning, status, created_at, responded_at FROM butler_authorizations WHERE id = ?`
	err := r.queryRowContext(ctx, query, id).Scan(
		&auth.ID, &auth.TargetAgentID, &auth.ProposedCommand, &auth.Reasoning,
		&auth.Status, &auth.CreatedAt, &respondedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, apperrors.Wrap(apperrors.ErrDatabase, "failed to get authorization", err)
	}

	if respondedAt.Valid {
		auth.RespondedAt = &respondedAt.Time
	}
	return &auth, nil
}

// InitializeAdmin creates the initial admin user if no users exist
func (r *sqlRepository) InitializeAdmin(ctx context.Context, username, password string, bcryptCost int) error {
	if username == "" || password == "" {
		return nil
	}

	var count int
	err := r.queryRowContext(ctx, "SELECT COUNT(*) FROM users").Scan(&count)
	if err != nil {
		return apperrors.Wrap(apperrors.ErrDatabase, "failed to check user count", err)
	}

	if count > 0 {
		return nil
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcryptCost)
	if err != nil {
		return apperrors.Wrap(apperrors.ErrInternal, "failed to hash password", err)
	}

	_, err = r.execContext(ctx,
		"INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)",
		username, string(hashedPassword), "ADMIN",
	)
	if err != nil {
		return apperrors.Wrap(apperrors.ErrDatabase, "failed to create admin user", err)
	}

	return nil
}

// InitializeButler ensures the Butler agent exists in the database
func (r *sqlRepository) InitializeButler(ctx context.Context) (*models.User, error) {
	var user models.User
	query := `SELECT id, username, role, api_token FROM users WHERE username = 'Butler' AND role = 'BUTLER' LIMIT 1`
	err := r.queryRowContext(ctx, query).Scan(&user.ID, &user.Username, &user.Role, &user.APIToken)

	if err == nil {
		return &user, nil // Already exists
	}

	if err != sql.ErrNoRows {
		return nil, apperrors.Wrap(apperrors.ErrDatabase, "failed to check for Butler", err)
	}

	// Create Butler
	log.Println("[Init] Creating default Butler agent...")
	token := "butler-core-token-automatically-generated"
	// Use a dummy password since Butler logs in via token
	dummyHash := "$2a$12$ve.vOPXLOXQ.XOnIDovYnu.id.X6Z.id.X6Z.id.X6Z.id.X6Z"

	query = `INSERT INTO users (username, password_hash, api_token, role) VALUES (?, ?, ?, ?)`
	id, err := r.insertAndReturnID(ctx, query, "Butler", dummyHash, token, "BUTLER")
	if err != nil {
		return nil, apperrors.Wrap(apperrors.ErrDatabase, "failed to create Butler", err)
	}

	user.ID = int(id)
	user.Username = "Butler"
	user.Role = "BUTLER"
	user.APIToken = token

	return &user, nil
}

// Close closes the database connection
func (r *sqlRepository) Close() error {
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

	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" {
		return true
	}

	// SQLite unique constraint errors contain "unique constraint failed"
	return strings.Contains(strings.ToLower(err.Error()), "unique constraint failed")
}
