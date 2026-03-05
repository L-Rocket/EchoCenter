package repository

import (
	"context"
	"database/sql"
	"log"

	"github.com/lea/echocenter/backend/internal/models"
	apperrors "github.com/lea/echocenter/backend/pkg/errors"
	"golang.org/x/crypto/bcrypt"
)

// InitializeAdmin creates the initial admin user if no users exist.
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

// InitializeButler ensures the Butler agent exists in the database.
func (r *sqlRepository) InitializeButler(ctx context.Context) (*models.User, error) {
	var user models.User
	query := `SELECT id, username, role, api_token FROM users WHERE username = 'Butler' AND role = 'BUTLER' LIMIT 1`
	err := r.queryRowContext(ctx, query).Scan(&user.ID, &user.Username, &user.Role, &user.APIToken)

	if err == nil {
		return &user, nil
	}
	if err != sql.ErrNoRows {
		return nil, apperrors.Wrap(apperrors.ErrDatabase, "failed to check for Butler", err)
	}

	log.Println("[Init] Creating default Butler agent...")
	token := "butler-core-token-automatically-generated"
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

// ResetMockData removes runtime data for local mock bootstrap.
func (r *sqlRepository) ResetMockData(ctx context.Context) error {
	if r.driver == driverPostgres {
		query := `TRUNCATE TABLE butler_authorizations, chat_messages, messages, users RESTART IDENTITY CASCADE`
		if _, err := r.execContext(ctx, query); err != nil {
			return apperrors.Wrap(apperrors.ErrDatabase, "failed to reset postgres mock data", err)
		}
		return nil
	}

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return apperrors.Wrap(apperrors.ErrDatabase, "failed to begin sqlite reset transaction", err)
	}

	statements := []string{
		"DELETE FROM butler_authorizations",
		"DELETE FROM chat_messages",
		"DELETE FROM messages",
		"DELETE FROM users",
		"DELETE FROM sqlite_sequence WHERE name IN ('users','messages','chat_messages')",
	}
	for _, stmt := range statements {
		if _, err := tx.Exec(stmt); err != nil {
			_ = tx.Rollback()
			return apperrors.Wrap(apperrors.ErrDatabase, "failed to reset sqlite mock data", err)
		}
	}

	if err := tx.Commit(); err != nil {
		return apperrors.Wrap(apperrors.ErrDatabase, "failed to commit sqlite reset transaction", err)
	}

	return nil
}
