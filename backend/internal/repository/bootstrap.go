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

	admin := &models.User{
		Username:     username,
		PasswordHash: string(hashedPassword),
		Role:         "ADMIN",
		ActorType:    actorTypeHuman,
	}
	if err := r.CreateUser(ctx, admin); err != nil {
		return apperrors.Wrap(apperrors.ErrDatabase, "failed to create admin user", err)
	}

	return nil
}

// InitializeButler ensures the Butler agent exists in the database.
func (r *sqlRepository) InitializeButler(ctx context.Context) (*models.User, error) {
	var user models.User
	query := `
		SELECT
			u.id,
			u.username,
			u.role,
			u.actor_type,
			COALESCE(mc.api_token, u.api_token) AS api_token
		FROM users u
		LEFT JOIN machine_credentials mc ON mc.user_id = u.id
		WHERE u.username = 'Butler' AND u.role = 'BUTLER'
		LIMIT 1
	`
	err := r.queryRowContext(ctx, query).Scan(&user.ID, &user.Username, &user.Role, &user.ActorType, &user.APIToken)
	if err == nil {
		return &user, nil
	}
	if err != sql.ErrNoRows {
		return nil, apperrors.Wrap(apperrors.ErrDatabase, "failed to check for Butler", err)
	}

	log.Println("[Init] Creating default Butler agent...")
	butler := &models.User{
		Username:     "Butler",
		PasswordHash: "$2a$12$ve.vOPXLOXQ.XOnIDovYnu.id.X6Z.id.X6Z.id.X6Z.id.X6Z",
		APIToken:     "butler-core-token-automatically-generated",
		Role:         "BUTLER",
		ActorType:    actorTypeSystem,
	}
	if err := r.CreateUser(ctx, butler); err != nil {
		return nil, apperrors.Wrap(apperrors.ErrDatabase, "failed to create Butler", err)
	}

	created, err := r.GetUserByUsername(ctx, butler.Username)
	if err != nil {
		return nil, apperrors.Wrap(apperrors.ErrDatabase, "failed to load Butler", err)
	}
	if created == nil {
		return nil, apperrors.New(apperrors.ErrDatabase, "created Butler not found")
	}
	return created, nil
}

// ResetMockData removes runtime data for local mock bootstrap.
func (r *sqlRepository) ResetMockData(ctx context.Context) error {
	if r.driver == driverPostgres {
		query := `TRUNCATE TABLE feishu_inbound_events, feishu_integration_logs, feishu_connectors, butler_authorizations, chat_messages, conversation_threads, machine_credentials, human_credentials, messages, users RESTART IDENTITY CASCADE`
		if _, err := r.execContext(ctx, query); err != nil {
			return apperrors.Wrap(apperrors.ErrDatabase, "failed to reset postgres mock data", err)
		}
		return nil
	}

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return apperrors.Wrap(apperrors.ErrDatabase, "failed to begin reset transaction", err)
	}

	statements := []string{
		"DELETE FROM feishu_inbound_events",
		"DELETE FROM feishu_integration_logs",
		"DELETE FROM feishu_connectors",
		"DELETE FROM butler_authorizations",
		"DELETE FROM chat_messages",
		"DELETE FROM conversation_threads",
		"DELETE FROM machine_credentials",
		"DELETE FROM human_credentials",
		"DELETE FROM messages",
		"DELETE FROM users",
		"DELETE FROM sqlite_sequence WHERE name IN ('users','messages','chat_messages','conversation_threads','feishu_connectors','feishu_integration_logs','feishu_inbound_events')",
	}
	for _, stmt := range statements {
		if _, err := tx.Exec(stmt); err != nil {
			_ = tx.Rollback()
			return apperrors.Wrap(apperrors.ErrDatabase, "failed to reset mock data", err)
		}
	}

	if err := tx.Commit(); err != nil {
		return apperrors.Wrap(apperrors.ErrDatabase, "failed to commit reset transaction", err)
	}

	return nil
}
