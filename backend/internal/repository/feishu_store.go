package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"strconv"
	"strings"
	"time"

	"github.com/lea/echocenter/backend/internal/models"
	apperrors "github.com/lea/echocenter/backend/pkg/errors"
)

type sqlScanner interface {
	Scan(dest ...any) error
}

func (r *sqlRepository) GetFeishuConnector(ctx context.Context) (*models.FeishuConnector, error) {
	query := `
		SELECT
			id, connector_name, enabled, status, app_id, app_secret, verification_token, encrypt_key,
			allow_dm, allow_group_mention, mention_required, prefix_command, ignore_bot_messages,
			rate_limit_per_minute, allowed_chat_ids, user_whitelist, callback_url, callback_verified,
			last_verified_at, created_at, updated_at
		FROM feishu_connectors
		ORDER BY id DESC
		LIMIT 1
	`
	connector, err := r.scanFeishuConnector(r.queryRowContext(ctx, query))
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, apperrors.Wrap(apperrors.ErrDatabase, "failed to query feishu connector", err)
	}
	return connector, nil
}

func (r *sqlRepository) CreateFeishuConnector(ctx context.Context, connector *models.FeishuConnector) error {
	if connector == nil {
		return apperrors.New(apperrors.ErrInvalidInput, "connector is required")
	}
	normalized := normalizeFeishuConnectorInput(connector)

	query := `
		INSERT INTO feishu_connectors (
			connector_name, enabled, status, app_id, app_secret, verification_token, encrypt_key,
			allow_dm, allow_group_mention, mention_required, prefix_command, ignore_bot_messages,
			rate_limit_per_minute, allowed_chat_ids, user_whitelist, callback_url, callback_verified, last_verified_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
	`

	id, err := r.insertAndReturnID(
		ctx, query,
		normalized.ConnectorName, normalized.Enabled, normalized.Status, normalized.AppID, normalized.AppSecret,
		normalized.VerificationToken, normalized.EncryptKey, normalized.AllowDM, normalized.AllowGroupMention,
		normalized.MentionRequired, normalized.PrefixCommand, normalized.IgnoreBotMessages,
		normalized.RateLimitPerMinute, marshalStringList(normalized.AllowedChatIDs), marshalStringList(normalized.UserWhitelist),
		normalized.CallbackURL, normalized.CallbackVerified, nullableTime(normalized.LastVerifiedAt),
	)
	if err != nil {
		return apperrors.Wrap(apperrors.ErrDatabase, "failed to create feishu connector", err)
	}

	created, err := r.getFeishuConnectorByID(ctx, int(id))
	if err != nil {
		return err
	}
	if created == nil {
		return apperrors.New(apperrors.ErrDatabase, "created feishu connector not found")
	}
	*connector = *created
	return nil
}

func (r *sqlRepository) UpdateFeishuConnector(ctx context.Context, connector *models.FeishuConnector) error {
	if connector == nil || connector.ID <= 0 {
		return apperrors.New(apperrors.ErrInvalidInput, "valid connector id is required")
	}
	normalized := normalizeFeishuConnectorInput(connector)

	query := `
		UPDATE feishu_connectors
		SET
			connector_name = ?,
			enabled = ?,
			status = ?,
			app_id = ?,
			app_secret = ?,
			verification_token = ?,
			encrypt_key = ?,
			allow_dm = ?,
			allow_group_mention = ?,
			mention_required = ?,
			prefix_command = ?,
			ignore_bot_messages = ?,
			rate_limit_per_minute = ?,
			allowed_chat_ids = ?,
			user_whitelist = ?,
			callback_url = ?,
			callback_verified = ?,
			last_verified_at = ?,
			updated_at = CURRENT_TIMESTAMP
		WHERE id = ?
	`

	result, err := r.execContext(
		ctx, query,
		normalized.ConnectorName, normalized.Enabled, normalized.Status, normalized.AppID, normalized.AppSecret,
		normalized.VerificationToken, normalized.EncryptKey, normalized.AllowDM, normalized.AllowGroupMention,
		normalized.MentionRequired, normalized.PrefixCommand, normalized.IgnoreBotMessages,
		normalized.RateLimitPerMinute, marshalStringList(normalized.AllowedChatIDs), marshalStringList(normalized.UserWhitelist),
		normalized.CallbackURL, normalized.CallbackVerified, nullableTime(normalized.LastVerifiedAt),
		normalized.ID,
	)
	if err != nil {
		return apperrors.Wrap(apperrors.ErrDatabase, "failed to update feishu connector", err)
	}

	affected, err := result.RowsAffected()
	if err != nil {
		return apperrors.Wrap(apperrors.ErrDatabase, "failed to inspect feishu connector update", err)
	}
	if affected == 0 {
		return apperrors.New(apperrors.ErrNotFound, "feishu connector not found")
	}

	updated, err := r.getFeishuConnectorByID(ctx, normalized.ID)
	if err != nil {
		return err
	}
	if updated == nil {
		return apperrors.New(apperrors.ErrNotFound, "feishu connector not found")
	}
	*connector = *updated
	return nil
}

func (r *sqlRepository) SetFeishuConnectorEnabled(ctx context.Context, id int, enabled bool) (*models.FeishuConnector, error) {
	status := "not_connected"
	if enabled {
		status = "connected"
	}
	query := `UPDATE feishu_connectors SET enabled = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
	result, err := r.execContext(ctx, query, enabled, status, id)
	if err != nil {
		return nil, apperrors.Wrap(apperrors.ErrDatabase, "failed to set feishu connector enabled state", err)
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return nil, apperrors.Wrap(apperrors.ErrDatabase, "failed to inspect feishu connector update", err)
	}
	if affected == 0 {
		return nil, apperrors.New(apperrors.ErrNotFound, "feishu connector not found")
	}
	return r.getFeishuConnectorByID(ctx, id)
}

func (r *sqlRepository) MarkFeishuConnectorVerified(ctx context.Context, id int, verifiedAt time.Time) (*models.FeishuConnector, error) {
	query := `
		UPDATE feishu_connectors
		SET callback_verified = ?, last_verified_at = ?, status = CASE WHEN enabled THEN 'connected' ELSE status END, updated_at = CURRENT_TIMESTAMP
		WHERE id = ?
	`
	result, err := r.execContext(ctx, query, true, verifiedAt.UTC(), id)
	if err != nil {
		return nil, apperrors.Wrap(apperrors.ErrDatabase, "failed to mark feishu callback verified", err)
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return nil, apperrors.Wrap(apperrors.ErrDatabase, "failed to inspect feishu connector update", err)
	}
	if affected == 0 {
		return nil, apperrors.New(apperrors.ErrNotFound, "feishu connector not found")
	}
	return r.getFeishuConnectorByID(ctx, id)
}

func (r *sqlRepository) AppendFeishuIntegrationLog(ctx context.Context, connectorID int, level, action, detail string) error {
	query := `INSERT INTO feishu_integration_logs (connector_id, level, action, detail) VALUES (?, ?, ?, ?)`
	if _, err := r.execContext(ctx, query, connectorID, strings.ToLower(strings.TrimSpace(level)), action, detail); err != nil {
		return apperrors.Wrap(apperrors.ErrDatabase, "failed to append feishu integration log", err)
	}
	return nil
}

func (r *sqlRepository) ListFeishuIntegrationLogs(ctx context.Context, connectorID int, cursor string, limit int) ([]models.IntegrationLog, string, error) {
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}

	var (
		rows *sql.Rows
		err  error
	)

	if cursor != "" {
		cursorID, parseErr := strconv.ParseInt(cursor, 10, 64)
		if parseErr != nil || cursorID <= 0 {
			return nil, "", apperrors.New(apperrors.ErrInvalidInput, "invalid log cursor")
		}
		query := `
			SELECT id, level, action, detail, created_at
			FROM feishu_integration_logs
			WHERE connector_id = ? AND id < ?
			ORDER BY id DESC
			LIMIT ?
		`
		rows, err = r.queryContext(ctx, query, connectorID, cursorID, limit)
	} else {
		query := `
			SELECT id, level, action, detail, created_at
			FROM feishu_integration_logs
			WHERE connector_id = ?
			ORDER BY id DESC
			LIMIT ?
		`
		rows, err = r.queryContext(ctx, query, connectorID, limit)
	}
	if err != nil {
		return nil, "", apperrors.Wrap(apperrors.ErrDatabase, "failed to list feishu integration logs", err)
	}
	defer rows.Close()

	logs := make([]models.IntegrationLog, 0, limit)
	for rows.Next() {
		var (
			rowID     int64
			item      models.IntegrationLog
			createdAt time.Time
		)
		if err := rows.Scan(&rowID, &item.Level, &item.Action, &item.Detail, &createdAt); err != nil {
			return nil, "", apperrors.Wrap(apperrors.ErrDatabase, "failed to scan feishu integration log", err)
		}
		item.ID = strconv.FormatInt(rowID, 10)
		item.Timestamp = createdAt.UTC()
		logs = append(logs, item)
	}
	if err := rows.Err(); err != nil {
		return nil, "", apperrors.Wrap(apperrors.ErrDatabase, "failed to iterate feishu integration logs", err)
	}

	nextCursor := ""
	if len(logs) == limit {
		nextCursor = logs[len(logs)-1].ID
	}
	return logs, nextCursor, nil
}

func (r *sqlRepository) RegisterFeishuInboundMessage(ctx context.Context, connectorID int, messageID, chatID, feishuUserID, rawPayload string) (bool, error) {
	query := `
		INSERT INTO feishu_inbound_events (connector_id, message_id, chat_id, feishu_user_id, raw_payload)
		VALUES (?, ?, ?, ?, ?)
	`
	if _, err := r.execContext(ctx, query, connectorID, messageID, chatID, feishuUserID, rawPayload); err != nil {
		if isUniqueConstraintError(err) {
			return false, nil
		}
		return false, apperrors.Wrap(apperrors.ErrDatabase, "failed to register feishu inbound message", err)
	}
	return true, nil
}

func (r *sqlRepository) GetLatestFeishuInboundTarget(ctx context.Context, connectorID int) (string, string, error) {
	query := `
		SELECT chat_id, feishu_user_id
		FROM feishu_inbound_events
		WHERE connector_id = ?
		ORDER BY id DESC
		LIMIT 1
	`
	var chatID, feishuUserID string
	if err := r.queryRowContext(ctx, query, connectorID).Scan(&chatID, &feishuUserID); err != nil {
		if err == sql.ErrNoRows {
			return "", "", nil
		}
		return "", "", apperrors.Wrap(apperrors.ErrDatabase, "failed to query latest feishu inbound target", err)
	}
	return strings.TrimSpace(chatID), strings.TrimSpace(feishuUserID), nil
}

func (r *sqlRepository) getFeishuConnectorByID(ctx context.Context, id int) (*models.FeishuConnector, error) {
	query := `
		SELECT
			id, connector_name, enabled, status, app_id, app_secret, verification_token, encrypt_key,
			allow_dm, allow_group_mention, mention_required, prefix_command, ignore_bot_messages,
			rate_limit_per_minute, allowed_chat_ids, user_whitelist, callback_url, callback_verified,
			last_verified_at, created_at, updated_at
		FROM feishu_connectors
		WHERE id = ?
	`
	connector, err := r.scanFeishuConnector(r.queryRowContext(ctx, query, id))
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, apperrors.Wrap(apperrors.ErrDatabase, "failed to query feishu connector by id", err)
	}
	return connector, nil
}

func (r *sqlRepository) scanFeishuConnector(scanner sqlScanner) (*models.FeishuConnector, error) {
	var (
		connector                       models.FeishuConnector
		allowedChatIDsRaw, whitelistRaw string
		lastVerifiedAt                  sql.NullTime
	)

	err := scanner.Scan(
		&connector.ID,
		&connector.ConnectorName,
		&connector.Enabled,
		&connector.Status,
		&connector.AppID,
		&connector.AppSecret,
		&connector.VerificationToken,
		&connector.EncryptKey,
		&connector.AllowDM,
		&connector.AllowGroupMention,
		&connector.MentionRequired,
		&connector.PrefixCommand,
		&connector.IgnoreBotMessages,
		&connector.RateLimitPerMinute,
		&allowedChatIDsRaw,
		&whitelistRaw,
		&connector.CallbackURL,
		&connector.CallbackVerified,
		&lastVerifiedAt,
		&connector.CreatedAt,
		&connector.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	connector.AllowedChatIDs = unmarshalStringList(allowedChatIDsRaw)
	connector.UserWhitelist = unmarshalStringList(whitelistRaw)
	if lastVerifiedAt.Valid {
		v := lastVerifiedAt.Time.UTC()
		connector.LastVerifiedAt = &v
	}
	return &connector, nil
}

func normalizeFeishuConnectorInput(input *models.FeishuConnector) *models.FeishuConnector {
	out := *input
	out.ConnectorName = strings.TrimSpace(out.ConnectorName)
	if out.ConnectorName == "" {
		out.ConnectorName = "Feishu Butler Connector"
	}
	out.Status = strings.TrimSpace(out.Status)
	if out.Status == "" {
		if out.Enabled {
			out.Status = "connected"
		} else {
			out.Status = "not_connected"
		}
	}
	out.PrefixCommand = strings.TrimSpace(out.PrefixCommand)
	// Empty prefix means accept plain-text messages without command prefix.
	if out.RateLimitPerMinute <= 0 {
		out.RateLimitPerMinute = 30
	}
	out.AllowedChatIDs = sanitizeStringList(out.AllowedChatIDs)
	out.UserWhitelist = sanitizeStringList(out.UserWhitelist)
	return &out
}

func sanitizeStringList(values []string) []string {
	if len(values) == 0 {
		return []string{}
	}
	uniq := make(map[string]struct{}, len(values))
	result := make([]string, 0, len(values))
	for _, raw := range values {
		v := strings.TrimSpace(raw)
		if v == "" {
			continue
		}
		if _, exists := uniq[v]; exists {
			continue
		}
		uniq[v] = struct{}{}
		result = append(result, v)
	}
	return result
}

func marshalStringList(values []string) string {
	normalized := sanitizeStringList(values)
	if len(normalized) == 0 {
		return "[]"
	}
	bytes, err := json.Marshal(normalized)
	if err != nil {
		return "[]"
	}
	return string(bytes)
}

func unmarshalStringList(raw string) []string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return []string{}
	}
	var values []string
	if err := json.Unmarshal([]byte(trimmed), &values); err != nil {
		return []string{}
	}
	return sanitizeStringList(values)
}

func nullableTime(v *time.Time) any {
	if v == nil {
		return nil
	}
	return v.UTC()
}
