package repository

import (
	"context"
	"database/sql"

	"github.com/lea/echocenter/backend/internal/models"
	apperrors "github.com/lea/echocenter/backend/pkg/errors"
)

// CreateUser creates a new user
func (r *sqliteRepository) CreateUser(ctx context.Context, user *models.User) error {
	query := `INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)`
	_, err := r.db.ExecContext(ctx, query, user.Username, user.PasswordHash, user.Role)
	if err != nil {
		if isUniqueConstraintError(err) {
			return apperrors.Wrap(apperrors.ErrConflict, "username already exists", err)
		}
		return apperrors.Wrap(apperrors.ErrDatabase, "failed to create user", err)
	}
	return nil
}

// GetUserByUsername retrieves a user by username
func (r *sqliteRepository) GetUserByUsername(ctx context.Context, username string) (*models.User, error) {
	var user models.User
	var apiToken sql.NullString

	query := `SELECT id, username, password_hash, api_token, role, created_at FROM users WHERE username = ?`
	err := r.db.QueryRowContext(ctx, query, username).Scan(
		&user.ID, &user.Username, &user.PasswordHash, &apiToken, &user.Role, &user.CreatedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, apperrors.Wrap(apperrors.ErrDatabase, "failed to get user by username", err)
	}

	if apiToken.Valid {
		user.ApiToken = apiToken.String
	}
	return &user, nil
}

// GetUserByID retrieves a user by ID
func (r *sqliteRepository) GetUserByID(ctx context.Context, id int) (*models.User, error) {
	var user models.User
	var apiToken sql.NullString

	query := `SELECT id, username, password_hash, api_token, role, created_at FROM users WHERE id = ?`
	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&user.ID, &user.Username, &user.PasswordHash, &apiToken, &user.Role, &user.CreatedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, apperrors.Wrap(apperrors.ErrDatabase, "failed to get user by id", err)
	}

	if apiToken.Valid {
		user.ApiToken = apiToken.String
	}
	return &user, nil
}

// GetAgentByToken retrieves an agent by API token
func (r *sqliteRepository) GetAgentByToken(ctx context.Context, token string) (*models.User, error) {
	var user models.User

	query := `SELECT id, username, role, created_at FROM users WHERE api_token = ? AND role = 'AGENT'`
	err := r.db.QueryRowContext(ctx, query, token).Scan(
		&user.ID, &user.Username, &user.Role, &user.CreatedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, apperrors.Wrap(apperrors.ErrDatabase, "failed to get agent by token", err)
	}

	user.ApiToken = token
	return &user, nil
}

// GetAgents retrieves all agents
func (r *sqliteRepository) GetAgents(ctx context.Context) ([]models.User, error) {
	query := `SELECT id, username, role, created_at FROM users WHERE role = 'AGENT'`
	rows, err := r.db.QueryContext(ctx, query)
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
func (r *sqliteRepository) GetUsers(ctx context.Context) ([]models.User, error) {
	query := `SELECT id, username, role, created_at FROM users`
	rows, err := r.db.QueryContext(ctx, query)
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
func (r *sqliteRepository) CreateAgent(ctx context.Context, username, token string) error {
	query := `INSERT INTO users (username, password_hash, api_token, role) VALUES (?, ?, ?, ?)`
	_, err := r.db.ExecContext(ctx, query, username, "AGENT_TOKEN_ONLY", token, "AGENT")
	if err != nil {
		if isUniqueConstraintError(err) {
			return apperrors.Wrap(apperrors.ErrConflict, "agent username already exists", err)
		}
		return apperrors.Wrap(apperrors.ErrDatabase, "failed to create agent", err)
	}
	return nil
}
