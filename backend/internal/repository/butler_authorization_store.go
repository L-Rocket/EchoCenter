package repository

import (
	"context"
	"database/sql"

	"github.com/lea/echocenter/backend/internal/models"
	apperrors "github.com/lea/echocenter/backend/pkg/errors"
)

// SaveAuthorization saves a butler authorization.
func (r *sqlRepository) SaveAuthorization(ctx context.Context, auth *models.ButlerAuthorization) error {
	query := `INSERT INTO butler_authorizations (id, target_agent_id, proposed_command, reasoning) VALUES (?, ?, ?, ?)`
	_, err := r.execContext(ctx, query, auth.ID, auth.TargetAgentID, auth.ProposedCommand, auth.Reasoning)
	if err != nil {
		return apperrors.Wrap(apperrors.ErrDatabase, "failed to save authorization", err)
	}
	return nil
}

// UpdateAuthorizationStatus updates the status of a butler authorization.
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

// GetAuthorization retrieves a butler authorization by ID.
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
