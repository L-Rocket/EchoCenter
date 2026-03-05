package repository

import (
	"context"
	"errors"
	"fmt"
	"path/filepath"
	"testing"

	"github.com/lea/echocenter/backend/internal/config"
	"github.com/lea/echocenter/backend/internal/models"
	apperrors "github.com/lea/echocenter/backend/pkg/errors"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newTestRepo(t *testing.T) Repository {
	t.Helper()

	dbPath := filepath.Join(t.TempDir(), "echo_test.db")
	repo, err := New(&config.DatabaseConfig{
		Driver:          "sqlite",
		Path:            dbPath,
		MaxOpenConns:    1,
		MaxIdleConns:    1,
		ConnMaxLifetime: 0,
	})
	require.NoError(t, err)
	t.Cleanup(func() { _ = repo.Close() })
	return repo
}

func TestCreateUserDuplicateReturnsConflict(t *testing.T) {
	repo := newTestRepo(t)
	ctx := context.Background()

	err := repo.CreateUser(ctx, &models.User{Username: "alice", PasswordHash: "h", Role: "MEMBER"})
	require.NoError(t, err)

	err = repo.CreateUser(ctx, &models.User{Username: "alice", PasswordHash: "h2", Role: "MEMBER"})
	require.Error(t, err)
	assert.True(t, apperrors.Is(err, apperrors.ErrConflict))
}

func TestSaveChatMessageIdempotentByLocalID(t *testing.T) {
	repo := newTestRepo(t)
	ctx := context.Background()

	msg := &models.ChatMessage{
		LocalID:    "local-123",
		SenderID:   1,
		ReceiverID: 2,
		Type:       "CHAT",
		Payload:    "hello",
	}
	require.NoError(t, repo.SaveChatMessage(ctx, msg))
	firstID, firstTime := msg.ID, msg.Timestamp
	require.NotZero(t, firstID)

	dup := &models.ChatMessage{
		LocalID:    "local-123",
		SenderID:   1,
		ReceiverID: 2,
		Type:       "CHAT",
		Payload:    "hello changed but should not be inserted",
	}
	require.NoError(t, repo.SaveChatMessage(ctx, dup))

	assert.Equal(t, firstID, dup.ID)
	assert.True(t, dup.Timestamp.Equal(firstTime))

	history, err := repo.GetChatHistory(ctx, 1, 2, 10)
	require.NoError(t, err)
	require.Len(t, history, 1)
	assert.Equal(t, firstID, history[0].ID)
	assert.Equal(t, "hello", history[0].Payload)
}

func TestUpdateAuthorizationStatusNotFound(t *testing.T) {
	repo := newTestRepo(t)
	err := repo.UpdateAuthorizationStatus(context.Background(), "missing-id", "APPROVED")
	require.Error(t, err)
	assert.True(t, apperrors.Is(err, apperrors.ErrNotFound))
}

func TestResetMockDataClearsTablesAndResetsIdentity(t *testing.T) {
	repo := newTestRepo(t)
	ctx := context.Background()

	err := repo.InitializeAdmin(ctx, "admin", "admin123", 4)
	require.NoError(t, err)

	err = repo.CreateUser(ctx, &models.User{Username: "alice", PasswordHash: "h", Role: "MEMBER"})
	require.NoError(t, err)

	msg := &models.Message{AgentID: "a", Level: "INFO", Content: "hello"}
	err = repo.CreateMessage(ctx, msg)
	require.NoError(t, err)
	require.NotZero(t, msg.ID)

	err = repo.ResetMockData(ctx)
	require.NoError(t, err)

	users, err := repo.GetUsers(ctx)
	require.NoError(t, err)
	assert.Len(t, users, 0)

	next := &models.Message{AgentID: "b", Level: "INFO", Content: "after reset"}
	err = repo.CreateMessage(ctx, next)
	require.NoError(t, err)
	assert.Equal(t, 1, next.ID)
}

func TestIsUniqueConstraintErrorSafeForShortMessages(t *testing.T) {
	shortErr := errors.New("bad")
	assert.NotPanics(t, func() {
		assert.False(t, isUniqueConstraintError(shortErr))
	})

	assert.True(t, isUniqueConstraintError(errors.New("UNIQUE constraint failed: users.username")))
	assert.True(t, isUniqueConstraintError(errors.New("unique constraint failed: users.username")))
	assert.False(t, isUniqueConstraintError(fmt.Errorf("wrapped: %w", shortErr)))
}

func TestCreateUserStoresHumanCredential(t *testing.T) {
	repo := newTestRepo(t)
	ctx := context.Background()

	err := repo.CreateUser(ctx, &models.User{
		Username:     "member1",
		PasswordHash: "hash-1",
		Role:         "MEMBER",
	})
	require.NoError(t, err)

	user, err := repo.GetUserByUsername(ctx, "member1")
	require.NoError(t, err)
	require.NotNil(t, user)
	assert.Equal(t, "hash-1", user.PasswordHash)
	assert.Equal(t, actorTypeHuman, user.ActorType)

	sqlRepo := repo.(*sqlRepository)
	var humanCount, machineCount int
	require.NoError(t, sqlRepo.queryRowContext(ctx, "SELECT COUNT(*) FROM human_credentials").Scan(&humanCount))
	require.NoError(t, sqlRepo.queryRowContext(ctx, "SELECT COUNT(*) FROM machine_credentials").Scan(&machineCount))
	assert.Equal(t, 1, humanCount)
	assert.Equal(t, 0, machineCount)
}

func TestCreateAgentStoresMachineCredentialAndLookupByToken(t *testing.T) {
	repo := newTestRepo(t)
	ctx := context.Background()

	err := repo.CreateAgent(ctx, "agentA", "tok-agent-A")
	require.NoError(t, err)

	agent, err := repo.GetAgentByToken(ctx, "tok-agent-A")
	require.NoError(t, err)
	require.NotNil(t, agent)
	assert.Equal(t, "agentA", agent.Username)
	assert.Equal(t, "AGENT", agent.Role)
	assert.Equal(t, actorTypeSystem, agent.ActorType)
	assert.Equal(t, "tok-agent-A", agent.APIToken)

	sqlRepo := repo.(*sqlRepository)
	var humanCount, machineCount int
	require.NoError(t, sqlRepo.queryRowContext(ctx, "SELECT COUNT(*) FROM human_credentials").Scan(&humanCount))
	require.NoError(t, sqlRepo.queryRowContext(ctx, "SELECT COUNT(*) FROM machine_credentials").Scan(&machineCount))
	assert.Equal(t, 0, humanCount)
	assert.Equal(t, 1, machineCount)
}
