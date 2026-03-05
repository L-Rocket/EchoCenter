package repository

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/lea/echocenter/backend/internal/models"
	apperrors "github.com/lea/echocenter/backend/pkg/errors"
)

// CreateUser creates a new user.
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

// GetUserByUsername retrieves a user by username.
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

// GetUserByID retrieves a user by ID.
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

// GetAgentByToken retrieves an agent by API token.
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

// GetAgents retrieves all agents (including Butler).
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

// GetUsers retrieves all users.
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

// CreateAgent creates a new agent.
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
