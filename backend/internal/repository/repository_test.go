package repository

import (
	"context"
	"errors"
	"fmt"
	"path/filepath"
	"testing"
	"time"

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

	agents, err := repo.GetAgents(ctx)
	require.NoError(t, err)
	require.Len(t, agents, 1)
	assert.Equal(t, "", agents[0].APIToken)
	assert.NotEmpty(t, agents[0].TokenHint)
}

func TestUpdateAgentTokenReplacesLookupToken(t *testing.T) {
	repo := newTestRepo(t)
	ctx := context.Background()

	require.NoError(t, repo.CreateAgent(ctx, "agent-token-rotate", "tok-old"))
	agent, err := repo.GetAgentByToken(ctx, "tok-old")
	require.NoError(t, err)
	require.NotNil(t, agent)

	require.NoError(t, repo.UpdateAgentToken(ctx, agent.ID, "tok-new"))

	oldAgent, err := repo.GetAgentByToken(ctx, "tok-old")
	require.NoError(t, err)
	assert.Nil(t, oldAgent)

	newAgent, err := repo.GetAgentByToken(ctx, "tok-new")
	require.NoError(t, err)
	require.NotNil(t, newAgent)
	assert.Equal(t, agent.ID, newAgent.ID)
}

func TestTokenHintHandlesSingleCharacterToken(t *testing.T) {
	assert.NotPanics(t, func() {
		assert.Equal(t, "a****", tokenHint("a"))
	})
}

func TestFeishuConnectorCRUD(t *testing.T) {
	repo := newTestRepo(t)
	ctx := context.Background()

	connector := &models.FeishuConnector{
		ConnectorName:      "Feishu Butler Connector",
		Enabled:            false,
		Status:             "not_connected",
		AppID:              "cli_xxx",
		AppSecret:          "secret-123456",
		VerificationToken:  "verify-abc",
		EncryptKey:         "enc-xyz",
		AllowDM:            true,
		AllowGroupMention:  true,
		MentionRequired:    true,
		PrefixCommand:      "/butler",
		IgnoreBotMessages:  true,
		RateLimitPerMinute: 45,
		AllowedChatIDs:     []string{"chat_a", "chat_b", "chat_a"},
		UserWhitelist:      []string{"ou_1", "ou_2", "ou_1"},
		CallbackURL:        "http://localhost:8080/api/integrations/feishu/callback",
	}

	require.NoError(t, repo.CreateFeishuConnector(ctx, connector))
	require.NotZero(t, connector.ID)

	loaded, err := repo.GetFeishuConnector(ctx)
	require.NoError(t, err)
	require.NotNil(t, loaded)
	assert.Equal(t, connector.ID, loaded.ID)
	assert.Equal(t, []string{"chat_a", "chat_b"}, loaded.AllowedChatIDs)
	assert.Equal(t, []string{"ou_1", "ou_2"}, loaded.UserWhitelist)

	loaded.PrefixCommand = "/ec"
	loaded.AllowDM = false
	loaded.AllowedChatIDs = []string{"chat_c"}
	require.NoError(t, repo.UpdateFeishuConnector(ctx, loaded))

	reloaded, err := repo.GetFeishuConnector(ctx)
	require.NoError(t, err)
	require.NotNil(t, reloaded)
	assert.Equal(t, "/ec", reloaded.PrefixCommand)
	assert.False(t, reloaded.AllowDM)
	assert.Equal(t, []string{"chat_c"}, reloaded.AllowedChatIDs)
}

func TestFeishuConnectorLogsAndInboundDedupe(t *testing.T) {
	repo := newTestRepo(t)
	ctx := context.Background()

	connector := &models.FeishuConnector{
		ConnectorName:      "Feishu Butler Connector",
		AppID:              "cli_xxx",
		VerificationToken:  "verify-abc",
		RateLimitPerMinute: 30,
		PrefixCommand:      "/butler",
	}
	require.NoError(t, repo.CreateFeishuConnector(ctx, connector))
	require.NotZero(t, connector.ID)

	verifiedAt := time.Now().UTC()
	verified, err := repo.MarkFeishuConnectorVerified(ctx, connector.ID, verifiedAt)
	require.NoError(t, err)
	require.NotNil(t, verified)
	assert.True(t, verified.CallbackVerified)
	require.NotNil(t, verified.LastVerifiedAt)

	enabled, err := repo.SetFeishuConnectorEnabled(ctx, connector.ID, true)
	require.NoError(t, err)
	require.NotNil(t, enabled)
	assert.True(t, enabled.Enabled)

	require.NoError(t, repo.AppendFeishuIntegrationLog(ctx, connector.ID, "INFO", "action_1", "detail_1"))
	require.NoError(t, repo.AppendFeishuIntegrationLog(ctx, connector.ID, "ERROR", "action_2", "detail_2"))
	require.NoError(t, repo.AppendFeishuIntegrationLog(ctx, connector.ID, "SUCCESS", "action_3", "detail_3"))

	firstPage, cursor, err := repo.ListFeishuIntegrationLogs(ctx, connector.ID, "", 2)
	require.NoError(t, err)
	require.Len(t, firstPage, 2)
	assert.NotEmpty(t, cursor)

	secondPage, _, err := repo.ListFeishuIntegrationLogs(ctx, connector.ID, cursor, 2)
	require.NoError(t, err)
	require.Len(t, secondPage, 1)

	added, err := repo.RegisterFeishuInboundMessage(ctx, connector.ID, "om_1", "chat_1", "ou_1", `{"text":"hello"}`)
	require.NoError(t, err)
	assert.True(t, added)

	added, err = repo.RegisterFeishuInboundMessage(ctx, connector.ID, "om_1", "chat_1", "ou_1", `{"text":"hello"}`)
	require.NoError(t, err)
	assert.False(t, added)
}
