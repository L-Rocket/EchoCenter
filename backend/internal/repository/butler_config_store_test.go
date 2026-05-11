package repository

import (
	"context"
	"testing"

	"github.com/lea/echocenter/backend/internal/models"
	apperrors "github.com/lea/echocenter/backend/pkg/errors"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetButlerRuntimeConfigReturnsNilWhenEmpty(t *testing.T) {
	repo := newTestRepo(t)
	cfg, err := repo.GetButlerRuntimeConfig(context.Background())
	require.NoError(t, err)
	assert.Nil(t, cfg)
}

func TestUpsertAndGetButlerRuntimeConfig(t *testing.T) {
	repo := newTestRepo(t)
	ctx := context.Background()

	in := &models.ButlerRuntimeConfig{
		ModelName: "gpt-4o",
		BaseURL:   "https://api.openai.com/v1",
		APIToken:  "sk-secret",
	}
	require.NoError(t, repo.UpsertButlerRuntimeConfig(ctx, in))

	out, err := repo.GetButlerRuntimeConfig(ctx)
	require.NoError(t, err)
	require.NotNil(t, out)
	assert.Equal(t, "gpt-4o", out.ModelName)
	assert.Equal(t, "https://api.openai.com/v1", out.BaseURL)
	assert.Equal(t, "sk-secret", out.APIToken)
	assert.Zero(t, out.UpdatedByID)
	assert.False(t, out.UpdatedAt.IsZero())
}

func TestUpsertButlerRuntimeConfigOverwritesExisting(t *testing.T) {
	repo := newTestRepo(t)
	ctx := context.Background()

	require.NoError(t, repo.UpsertButlerRuntimeConfig(ctx, &models.ButlerRuntimeConfig{
		ModelName: "claude-3-opus",
		BaseURL:   "https://api.anthropic.com/v1",
		APIToken:  "sk-ant-old",
	}))

	require.NoError(t, repo.UpsertButlerRuntimeConfig(ctx, &models.ButlerRuntimeConfig{
		ModelName: "claude-sonnet-4-6",
		BaseURL:   "https://api.anthropic.com/v1",
		APIToken:  "sk-ant-new",
	}))

	out, err := repo.GetButlerRuntimeConfig(ctx)
	require.NoError(t, err)
	require.NotNil(t, out)
	assert.Equal(t, "claude-sonnet-4-6", out.ModelName)
	assert.Equal(t, "sk-ant-new", out.APIToken)

	// Only one row ever exists (id=1 constraint).
	sqlRepo := repo.(*sqlRepository)
	var count int
	require.NoError(t, sqlRepo.queryRowContext(ctx, "SELECT COUNT(*) FROM butler_runtime_config").Scan(&count))
	assert.Equal(t, 1, count)
}

func TestUpsertButlerRuntimeConfigWithUpdatedByID(t *testing.T) {
	repo := newTestRepo(t)
	ctx := context.Background()

	// Create a real user so the FK (if enforced) is satisfied.
	require.NoError(t, repo.InitializeAdmin(ctx, "admin", "admin-hash", 4))

	require.NoError(t, repo.UpsertButlerRuntimeConfig(ctx, &models.ButlerRuntimeConfig{
		ModelName:   "gpt-4o",
		BaseURL:     "https://api.openai.com/v1",
		APIToken:    "sk-x",
		UpdatedByID: 1,
	}))

	out, err := repo.GetButlerRuntimeConfig(ctx)
	require.NoError(t, err)
	require.NotNil(t, out)
	assert.Equal(t, 1, out.UpdatedByID)
}

func TestUpsertButlerRuntimeConfigNilReturnsError(t *testing.T) {
	repo := newTestRepo(t)
	err := repo.UpsertButlerRuntimeConfig(context.Background(), nil)
	require.Error(t, err)
	assert.True(t, apperrors.Is(err, apperrors.ErrInvalidInput))
}

func TestDeleteButlerRuntimeConfigClearsRecord(t *testing.T) {
	repo := newTestRepo(t)
	ctx := context.Background()

	require.NoError(t, repo.UpsertButlerRuntimeConfig(ctx, &models.ButlerRuntimeConfig{
		ModelName: "gpt-4o",
		BaseURL:   "https://api.openai.com/v1",
		APIToken:  "sk-del",
	}))

	require.NoError(t, repo.DeleteButlerRuntimeConfig(ctx))

	out, err := repo.GetButlerRuntimeConfig(ctx)
	require.NoError(t, err)
	assert.Nil(t, out)
}

func TestDeleteButlerRuntimeConfigIsIdempotent(t *testing.T) {
	repo := newTestRepo(t)
	ctx := context.Background()

	// Delete on an empty table must not return an error.
	require.NoError(t, repo.DeleteButlerRuntimeConfig(ctx))
	require.NoError(t, repo.DeleteButlerRuntimeConfig(ctx))
}

func TestUpsertButlerRuntimeConfigEmptyTokenAllowed(t *testing.T) {
	repo := newTestRepo(t)
	ctx := context.Background()

	require.NoError(t, repo.UpsertButlerRuntimeConfig(ctx, &models.ButlerRuntimeConfig{
		ModelName: "local-model",
		BaseURL:   "http://localhost:11434/v1",
		APIToken:  "",
	}))

	out, err := repo.GetButlerRuntimeConfig(ctx)
	require.NoError(t, err)
	require.NotNil(t, out)
	assert.Equal(t, "", out.APIToken)
}
