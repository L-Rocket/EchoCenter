package repository

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/lea/echocenter/backend/internal/models"
	apperrors "github.com/lea/echocenter/backend/pkg/errors"
)

const (
	actorTypeHuman  = "HUMAN"
	actorTypeSystem = "SYSTEM"
)

// CreateUser creates a new principal and its credentials.
func (r *sqlRepository) CreateUser(ctx context.Context, user *models.User) error {
	if user == nil {
		return apperrors.New(apperrors.ErrInvalidInput, "user is required")
	}

	role := strings.ToUpper(strings.TrimSpace(user.Role))
	if role == "" {
		role = "MEMBER"
	}

	actorType := strings.ToUpper(strings.TrimSpace(user.ActorType))
	if actorType == "" {
		actorType = actorTypeFromRole(role)
	}
	if role == "AGENT" || role == "BUTLER" {
		actorType = actorTypeSystem
	}

	passwordHash := user.PasswordHash
	apiToken := strings.TrimSpace(user.APIToken)

	if actorType == actorTypeSystem {
		if apiToken == "" && role == "AGENT" {
			apiToken = fmt.Sprintf("agent-%s-token-%d", user.Username, time.Now().UnixNano())
		}
		if passwordHash == "" {
			passwordHash = "AGENT_TOKEN_ONLY"
		}
	} else {
		// Human principals authenticate with password credentials.
		apiToken = ""
	}

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return apperrors.Wrap(apperrors.ErrDatabase, "failed to start create-user transaction", err)
	}

	query := `INSERT INTO users (username, password_hash, api_token, role, actor_type) VALUES (?, ?, ?, ?, ?)`
	userID, err := r.txInsertAndReturnID(tx, query, user.Username, passwordHash, nullableString(apiToken), role, actorType)
	if err != nil {
		_ = tx.Rollback()
		if isUniqueConstraintError(err) {
			return apperrors.Wrap(apperrors.ErrConflict, "username already exists", err)
		}
		return apperrors.Wrap(apperrors.ErrDatabase, "failed to create user", err)
	}

	if actorType == actorTypeHuman {
		if err := r.upsertHumanCredentialTx(tx, userID, passwordHash); err != nil {
			_ = tx.Rollback()
			return wrapCredentialWriteError("failed to save human credential", err)
		}
	}

	if actorType == actorTypeSystem && apiToken != "" {
		if err := r.upsertMachineCredentialTx(tx, userID, apiToken); err != nil {
			_ = tx.Rollback()
			return wrapCredentialWriteError("failed to save machine credential", err)
		}
	}

	if err := tx.Commit(); err != nil {
		return apperrors.Wrap(apperrors.ErrDatabase, "failed to commit create-user transaction", err)
	}

	user.ID = int(userID)
	user.Role = role
	user.ActorType = actorType
	user.PasswordHash = passwordHash
	user.APIToken = apiToken
	return nil
}

// GetUserByUsername retrieves a user by username.
func (r *sqlRepository) GetUserByUsername(ctx context.Context, username string) (*models.User, error) {
	var (
		user      models.User
		apiToken  sql.NullString
		actorType sql.NullString
	)

	query := `
		SELECT
			u.id,
			u.username,
			COALESCE(h.password_hash, u.password_hash) AS password_hash,
			COALESCE(mc.api_token, u.api_token) AS api_token,
			u.role,
			u.actor_type,
			u.created_at
		FROM users u
		LEFT JOIN human_credentials h ON h.user_id = u.id
		LEFT JOIN machine_credentials mc ON mc.user_id = u.id
		WHERE u.username = ?
	`
	err := r.queryRowContext(ctx, query, username).Scan(
		&user.ID,
		&user.Username,
		&user.PasswordHash,
		&apiToken,
		&user.Role,
		&actorType,
		&user.CreatedAt,
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
	if actorType.Valid {
		user.ActorType = actorType.String
	} else {
		user.ActorType = actorTypeFromRole(user.Role)
	}

	return &user, nil
}

// GetUserByID retrieves a user by ID.
func (r *sqlRepository) GetUserByID(ctx context.Context, id int) (*models.User, error) {
	var (
		user      models.User
		apiToken  sql.NullString
		actorType sql.NullString
	)

	query := `
		SELECT
			u.id,
			u.username,
			COALESCE(h.password_hash, u.password_hash) AS password_hash,
			COALESCE(mc.api_token, u.api_token) AS api_token,
			u.role,
			u.actor_type,
			u.created_at
		FROM users u
		LEFT JOIN human_credentials h ON h.user_id = u.id
		LEFT JOIN machine_credentials mc ON mc.user_id = u.id
		WHERE u.id = ?
	`
	err := r.queryRowContext(ctx, query, id).Scan(
		&user.ID,
		&user.Username,
		&user.PasswordHash,
		&apiToken,
		&user.Role,
		&actorType,
		&user.CreatedAt,
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
	if actorType.Valid {
		user.ActorType = actorType.String
	} else {
		user.ActorType = actorTypeFromRole(user.Role)
	}

	return &user, nil
}

// GetAgentByToken retrieves an agent by API token.
func (r *sqlRepository) GetAgentByToken(ctx context.Context, token string) (*models.User, error) {
	var (
		user      models.User
		apiToken  sql.NullString
		actorType sql.NullString
	)

	query := `
		SELECT
			u.id,
			u.username,
			u.role,
			u.actor_type,
			u.created_at,
			COALESCE(mc.api_token, u.api_token) AS api_token
		FROM users u
		LEFT JOIN machine_credentials mc ON mc.user_id = u.id
		WHERE u.role = 'AGENT' AND COALESCE(mc.api_token, u.api_token) = ?
		LIMIT 1
	`
	err := r.queryRowContext(ctx, query, token).Scan(
		&user.ID,
		&user.Username,
		&user.Role,
		&actorType,
		&user.CreatedAt,
		&apiToken,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, apperrors.Wrap(apperrors.ErrDatabase, "failed to get agent by token", err)
	}

	if apiToken.Valid {
		user.APIToken = apiToken.String
	}
	if actorType.Valid {
		user.ActorType = actorType.String
	} else {
		user.ActorType = actorTypeFromRole(user.Role)
	}
	return &user, nil
}

// GetAgents retrieves all agents (including Butler).
func (r *sqlRepository) GetAgents(ctx context.Context) ([]models.User, error) {
	query := `SELECT id, username, role, actor_type, created_at FROM users WHERE role IN ('AGENT', 'BUTLER')`
	rows, err := r.queryContext(ctx, query)
	if err != nil {
		return nil, apperrors.Wrap(apperrors.ErrDatabase, "failed to query agents", err)
	}
	defer rows.Close()

	var agents []models.User
	for rows.Next() {
		var (
			u         models.User
			actorType sql.NullString
		)
		if err := rows.Scan(&u.ID, &u.Username, &u.Role, &actorType, &u.CreatedAt); err != nil {
			return nil, apperrors.Wrap(apperrors.ErrDatabase, "failed to scan agent", err)
		}
		if actorType.Valid {
			u.ActorType = actorType.String
		} else {
			u.ActorType = actorTypeFromRole(u.Role)
		}
		agents = append(agents, u)
	}

	if err := rows.Err(); err != nil {
		return nil, apperrors.Wrap(apperrors.ErrDatabase, "error iterating agents", err)
	}

	return agents, nil
}

// GetUsers retrieves all users.
func (r *sqlRepository) GetUsers(ctx context.Context) ([]models.User, error) {
	query := `SELECT id, username, role, actor_type, created_at FROM users`
	rows, err := r.queryContext(ctx, query)
	if err != nil {
		return nil, apperrors.Wrap(apperrors.ErrDatabase, "failed to query users", err)
	}
	defer rows.Close()

	var users []models.User
	for rows.Next() {
		var (
			u         models.User
			actorType sql.NullString
		)
		if err := rows.Scan(&u.ID, &u.Username, &u.Role, &actorType, &u.CreatedAt); err != nil {
			return nil, apperrors.Wrap(apperrors.ErrDatabase, "failed to scan user", err)
		}
		if actorType.Valid {
			u.ActorType = actorType.String
		} else {
			u.ActorType = actorTypeFromRole(u.Role)
		}
		users = append(users, u)
	}

	if err := rows.Err(); err != nil {
		return nil, apperrors.Wrap(apperrors.ErrDatabase, "error iterating users", err)
	}

	return users, nil
}

// CreateAgent creates a new agent.
func (r *sqlRepository) CreateAgent(ctx context.Context, username, token string) error {
	user := &models.User{
		Username:     username,
		PasswordHash: "AGENT_TOKEN_ONLY",
		APIToken:     token,
		Role:         "AGENT",
		ActorType:    actorTypeSystem,
	}
	return r.CreateUser(ctx, user)
}

func (r *sqlRepository) upsertHumanCredentialTx(tx *sql.Tx, userID int64, passwordHash string) error {
	query := `
		INSERT INTO human_credentials (user_id, password_hash)
		VALUES (?, ?)
		ON CONFLICT(user_id) DO UPDATE SET
			password_hash = excluded.password_hash,
			updated_at = CURRENT_TIMESTAMP
	`
	_, err := r.txExec(tx, query, userID, passwordHash)
	return err
}

func (r *sqlRepository) upsertMachineCredentialTx(tx *sql.Tx, userID int64, apiToken string) error {
	query := `
		INSERT INTO machine_credentials (user_id, api_token)
		VALUES (?, ?)
		ON CONFLICT(user_id) DO UPDATE SET
			api_token = excluded.api_token,
			updated_at = CURRENT_TIMESTAMP
	`
	_, err := r.txExec(tx, query, userID, apiToken)
	return err
}

func actorTypeFromRole(role string) string {
	switch strings.ToUpper(strings.TrimSpace(role)) {
	case "AGENT", "BUTLER":
		return actorTypeSystem
	default:
		return actorTypeHuman
	}
}

func wrapCredentialWriteError(message string, err error) error {
	if isUniqueConstraintError(err) {
		return apperrors.Wrap(apperrors.ErrConflict, message, err)
	}
	return apperrors.Wrap(apperrors.ErrDatabase, message, err)
}

func nullableString(value string) any {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	return value
}
