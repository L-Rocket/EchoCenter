package repository

import (
	"context"
	"database/sql"
	"time"

	"github.com/lea/echocenter/backend/internal/models"
	apperrors "github.com/lea/echocenter/backend/pkg/errors"
)

func (r *sqlRepository) GetButlerRuntimeConfig(ctx context.Context) (*models.ButlerRuntimeConfig, error) {
	query := `
		SELECT model_name, base_url, api_token, updated_by_id, updated_at
		FROM butler_runtime_config
		WHERE id = 1
	`
	var (
		cfg         models.ButlerRuntimeConfig
		updatedByID sql.NullInt64
		updatedAt   time.Time
	)
	err := r.queryRowContext(ctx, query).Scan(
		&cfg.ModelName, &cfg.BaseURL, &cfg.APIToken, &updatedByID, &updatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, apperrors.Wrap(apperrors.ErrDatabase, "failed to query butler runtime config", err)
	}
	if updatedByID.Valid {
		cfg.UpdatedByID = int(updatedByID.Int64)
	}
	cfg.UpdatedAt = updatedAt.UTC()
	return &cfg, nil
}

func (r *sqlRepository) UpsertButlerRuntimeConfig(ctx context.Context, cfg *models.ButlerRuntimeConfig) error {
	if cfg == nil {
		return apperrors.New(apperrors.ErrInvalidInput, "butler runtime config is required")
	}
	query := `
		INSERT INTO butler_runtime_config (id, model_name, base_url, api_token, updated_by_id, updated_at)
		VALUES (1, ?, ?, ?, ?, CURRENT_TIMESTAMP)
		ON CONFLICT (id) DO UPDATE SET
			model_name = EXCLUDED.model_name,
			base_url = EXCLUDED.base_url,
			api_token = EXCLUDED.api_token,
			updated_by_id = EXCLUDED.updated_by_id,
			updated_at = CURRENT_TIMESTAMP
	`
	var updatedByID any
	if cfg.UpdatedByID > 0 {
		updatedByID = cfg.UpdatedByID
	}
	if _, err := r.execContext(ctx, query, cfg.ModelName, cfg.BaseURL, cfg.APIToken, updatedByID); err != nil {
		return apperrors.Wrap(apperrors.ErrDatabase, "failed to upsert butler runtime config", err)
	}
	return nil
}

func (r *sqlRepository) DeleteButlerRuntimeConfig(ctx context.Context) error {
	query := `DELETE FROM butler_runtime_config WHERE id = 1`
	if _, err := r.execContext(ctx, query); err != nil {
		return apperrors.Wrap(apperrors.ErrDatabase, "failed to delete butler runtime config", err)
	}
	return nil
}
