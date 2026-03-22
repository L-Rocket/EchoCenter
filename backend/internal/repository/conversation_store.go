package repository

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/lea/echocenter/backend/internal/models"
	apperrors "github.com/lea/echocenter/backend/pkg/errors"
)

const (
	channelKindButlerDirect = "butler_direct"
	channelKindAgentDirect  = "agent_direct"
)

func (r *sqlRepository) GetConversationThread(ctx context.Context, threadID int) (*models.ConversationThread, error) {
	thread, err := r.scanConversationThread(r.queryRowContext(ctx, `
		SELECT id, owner_user_id, peer_user_id, channel_kind, title, summary, is_pinned, is_default, archived_at, last_message_at, created_at, updated_at
		FROM conversation_threads
		WHERE id = ?
	`, threadID))
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, apperrors.Wrap(apperrors.ErrDatabase, "failed to get conversation thread", err)
	}
	return thread, nil
}

func (r *sqlRepository) ListConversationThreads(ctx context.Context, ownerUserID, peerUserID int, channelKind string) ([]models.ConversationThread, error) {
	query := `
		SELECT id, owner_user_id, peer_user_id, channel_kind, title, summary, is_pinned, is_default, archived_at, last_message_at, created_at, updated_at
		FROM conversation_threads
		WHERE owner_user_id = ?
	`
	args := []any{ownerUserID}
	if peerUserID > 0 {
		query += " AND peer_user_id = ?"
		args = append(args, peerUserID)
	}
	if strings.TrimSpace(channelKind) != "" {
		query += " AND channel_kind = ?"
		args = append(args, strings.TrimSpace(channelKind))
	}
	query += " ORDER BY is_pinned DESC, last_message_at DESC NULLS LAST, updated_at DESC, id DESC"
	if r.driver == driverSQLite {
		query = strings.ReplaceAll(query, " NULLS LAST", "")
	}

	rows, err := r.queryContext(ctx, query, args...)
	if err != nil {
		return nil, apperrors.Wrap(apperrors.ErrDatabase, "failed to list conversation threads", err)
	}
	defer rows.Close()

	var threads []models.ConversationThread
	for rows.Next() {
		thread, err := r.scanConversationThread(rows)
		if err != nil {
			return nil, apperrors.Wrap(apperrors.ErrDatabase, "failed to scan conversation thread", err)
		}
		threads = append(threads, *thread)
	}
	if err := rows.Err(); err != nil {
		return nil, apperrors.Wrap(apperrors.ErrDatabase, "error iterating conversation threads", err)
	}
	return threads, nil
}

func (r *sqlRepository) CreateConversationThread(ctx context.Context, thread *models.ConversationThread) error {
	if thread == nil {
		return apperrors.New(apperrors.ErrInvalidInput, "thread is required")
	}
	title := strings.TrimSpace(thread.Title)
	if title == "" {
		title = "New conversation"
	}
	summary := strings.TrimSpace(thread.Summary)
	now := time.Now()
	if thread.LastMessageAt == nil {
		thread.LastMessageAt = nil
	}

	id, err := r.insertAndReturnID(ctx, `
		INSERT INTO conversation_threads (owner_user_id, peer_user_id, channel_kind, title, summary, is_pinned, is_default, archived_at, last_message_at, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`,
		thread.OwnerUserID,
		thread.PeerUserID,
		thread.ChannelKind,
		title,
		summary,
		thread.IsPinned,
		thread.IsDefault,
		nullTime(thread.ArchivedAt),
		nullTime(thread.LastMessageAt),
		now,
		now,
	)
	if err != nil {
		return apperrors.Wrap(apperrors.ErrDatabase, "failed to create conversation thread", err)
	}
	thread.ID = int(id)
	thread.Title = title
	thread.Summary = summary
	thread.CreatedAt = now
	thread.UpdatedAt = now
	return nil
}

func (r *sqlRepository) UpdateConversationThread(ctx context.Context, thread *models.ConversationThread) error {
	if thread == nil || thread.ID <= 0 {
		return apperrors.New(apperrors.ErrInvalidInput, "valid thread is required")
	}
	now := time.Now()
	_, err := r.execContext(ctx, `
		UPDATE conversation_threads
		SET title = ?, summary = ?, is_pinned = ?, archived_at = ?, last_message_at = ?, updated_at = ?
		WHERE id = ?
	`,
		strings.TrimSpace(thread.Title),
		strings.TrimSpace(thread.Summary),
		thread.IsPinned,
		nullTime(thread.ArchivedAt),
		nullTime(thread.LastMessageAt),
		now,
		thread.ID,
	)
	if err != nil {
		return apperrors.Wrap(apperrors.ErrDatabase, "failed to update conversation thread", err)
	}
	thread.UpdatedAt = now
	return nil
}

func (r *sqlRepository) GetConversationMessages(ctx context.Context, threadID, limit int) ([]models.ChatMessage, error) {
	if limit <= 0 {
		limit = 100
	}
	rows, err := r.queryContext(ctx, `
		SELECT id, local_id, conversation_id, sender_id, receiver_id, type, content, timestamp
		FROM chat_messages
		WHERE conversation_id = ?
		ORDER BY timestamp ASC, id ASC
		LIMIT ?
	`, threadID, limit)
	if err != nil {
		return nil, apperrors.Wrap(apperrors.ErrDatabase, "failed to query conversation messages", err)
	}
	defer rows.Close()

	var messages []models.ChatMessage
	for rows.Next() {
		var m models.ChatMessage
		var msgType sql.NullString
		var localID sql.NullString
		var conversationID sql.NullInt64
		if err := rows.Scan(&m.ID, &localID, &conversationID, &m.SenderID, &m.ReceiverID, &msgType, &m.Payload, &m.Timestamp); err != nil {
			return nil, apperrors.Wrap(apperrors.ErrDatabase, "failed to scan conversation message", err)
		}
		if localID.Valid {
			m.LocalID = localID.String
		}
		if conversationID.Valid {
			m.ConversationID = int(conversationID.Int64)
		}
		if msgType.Valid {
			m.Type = msgType.String
		} else {
			m.Type = "CHAT"
		}
		messages = append(messages, m)
	}
	if err := rows.Err(); err != nil {
		return nil, apperrors.Wrap(apperrors.ErrDatabase, "error iterating conversation messages", err)
	}
	return messages, nil
}

func (r *sqlRepository) getOrCreateDefaultConversationThread(ctx context.Context, ownerUserID, peerUserID int, channelKind string) (*models.ConversationThread, error) {
	if ownerUserID <= 0 || peerUserID <= 0 || strings.TrimSpace(channelKind) == "" {
		return nil, nil
	}

	thread, err := r.scanConversationThread(r.queryRowContext(ctx, `
		SELECT id, owner_user_id, peer_user_id, channel_kind, title, summary, is_pinned, is_default, archived_at, last_message_at, created_at, updated_at
		FROM conversation_threads
		WHERE owner_user_id = ? AND peer_user_id = ? AND channel_kind = ? AND is_default = ?
		LIMIT 1
	`, ownerUserID, peerUserID, channelKind, true))
	if err == nil {
		return thread, nil
	}
	if err != sql.ErrNoRows {
		return nil, apperrors.Wrap(apperrors.ErrDatabase, "failed to load default conversation thread", err)
	}

	peer, _ := r.GetUserByID(ctx, peerUserID)
	title := describeThreadTitle(peer, channelKind)
	thread = &models.ConversationThread{
		OwnerUserID: ownerUserID,
		PeerUserID:  peerUserID,
		ChannelKind: channelKind,
		Title:       title,
		IsDefault:   true,
	}
	if err := r.CreateConversationThread(ctx, thread); err != nil {
		return nil, err
	}
	return thread, nil
}

func (r *sqlRepository) touchConversationThread(ctx context.Context, threadID int, timestamp time.Time) error {
	if threadID <= 0 {
		return nil
	}
	_, err := r.execContext(ctx, `
		UPDATE conversation_threads
		SET last_message_at = ?, updated_at = ?
		WHERE id = ?
	`, timestamp, timestamp, threadID)
	if err != nil {
		return apperrors.Wrap(apperrors.ErrDatabase, "failed to update conversation thread timestamp", err)
	}
	return nil
}

func (r *sqlRepository) inferDirectConversation(ctx context.Context, senderID, receiverID int) (*models.ConversationThread, error) {
	sender, err := r.GetUserByID(ctx, senderID)
	if err != nil {
		return nil, err
	}
	receiver, err := r.GetUserByID(ctx, receiverID)
	if err != nil {
		return nil, err
	}
	if sender == nil || receiver == nil {
		return nil, nil
	}

	var owner, peer *models.User
	switch {
	case strings.EqualFold(sender.ActorType, actorTypeHuman) && !strings.EqualFold(receiver.ActorType, actorTypeHuman):
		owner, peer = sender, receiver
	case strings.EqualFold(receiver.ActorType, actorTypeHuman) && !strings.EqualFold(sender.ActorType, actorTypeHuman):
		owner, peer = receiver, sender
	case strings.EqualFold(sender.ActorType, actorTypeHuman) && strings.EqualFold(receiver.ActorType, actorTypeHuman):
		owner, peer = sender, receiver
	default:
		return nil, nil
	}

	channelKind := inferChannelKind(peer)
	if channelKind == "" {
		return nil, nil
	}
	return r.getOrCreateDefaultConversationThread(ctx, owner.ID, peer.ID, channelKind)
}

func inferChannelKind(peer *models.User) string {
	if peer == nil {
		return ""
	}
	switch strings.ToUpper(strings.TrimSpace(peer.Role)) {
	case "BUTLER":
		return channelKindButlerDirect
	case "AGENT":
		return channelKindAgentDirect
	default:
		return ""
	}
}

func defaultConversationTitle(channelKind string) string {
	switch channelKind {
	case channelKindButlerDirect:
		return "Butler"
	case channelKindAgentDirect:
		return "Agent conversation"
	default:
		return "New conversation"
	}
}

func (r *sqlRepository) backfillConversationThreads(ctx context.Context) error {
	rows, err := r.queryContext(ctx, `
		SELECT DISTINCT sender_id, receiver_id
		FROM chat_messages
		WHERE conversation_id IS NULL
		ORDER BY sender_id ASC, receiver_id ASC
	`)
	if err != nil {
		return apperrors.Wrap(apperrors.ErrDatabase, "failed to query chat message pairs for thread backfill", err)
	}
	defer rows.Close()

	type pair struct{ senderID, receiverID int }
	var pairs []pair
	for rows.Next() {
		var p pair
		if err := rows.Scan(&p.senderID, &p.receiverID); err != nil {
			return apperrors.Wrap(apperrors.ErrDatabase, "failed to scan chat message pair", err)
		}
		pairs = append(pairs, p)
	}
	if err := rows.Err(); err != nil {
		return apperrors.Wrap(apperrors.ErrDatabase, "failed iterating chat message pairs", err)
	}

	for _, p := range pairs {
		thread, err := r.inferDirectConversation(ctx, p.senderID, p.receiverID)
		if err != nil {
			return err
		}
		if thread == nil {
			continue
		}
		if _, err := r.execContext(ctx, `
			UPDATE chat_messages
			SET conversation_id = ?
			WHERE conversation_id IS NULL
			  AND ((sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?))
		`, thread.ID, p.senderID, p.receiverID, p.receiverID, p.senderID); err != nil {
			return apperrors.Wrap(apperrors.ErrDatabase, "failed to backfill chat message conversation id", err)
		}
		if _, err := r.execContext(ctx, `
			UPDATE conversation_threads
			SET last_message_at = (
				SELECT MAX(timestamp) FROM chat_messages WHERE conversation_id = ?
			),
			updated_at = CURRENT_TIMESTAMP
			WHERE id = ?
		`, thread.ID, thread.ID); err != nil {
			return apperrors.Wrap(apperrors.ErrDatabase, "failed to refresh thread last message time", err)
		}
	}

	return nil
}

func (r *sqlRepository) scanConversationThread(scanner interface{ Scan(dest ...any) error }) (*models.ConversationThread, error) {
	var thread models.ConversationThread
	var archivedAt sql.NullTime
	var lastMessageAt sql.NullTime
	if err := scanner.Scan(
		&thread.ID,
		&thread.OwnerUserID,
		&thread.PeerUserID,
		&thread.ChannelKind,
		&thread.Title,
		&thread.Summary,
		&thread.IsPinned,
		&thread.IsDefault,
		&archivedAt,
		&lastMessageAt,
		&thread.CreatedAt,
		&thread.UpdatedAt,
	); err != nil {
		return nil, err
	}
	if archivedAt.Valid {
		thread.ArchivedAt = &archivedAt.Time
	}
	if lastMessageAt.Valid {
		thread.LastMessageAt = &lastMessageAt.Time
	}
	return &thread, nil
}

func nullTime(t *time.Time) any {
	if t == nil {
		return nil
	}
	return *t
}

func describeThreadTitle(peer *models.User, channelKind string) string {
	if peer == nil {
		return defaultConversationTitle(channelKind)
	}
	switch channelKind {
	case channelKindButlerDirect:
		return "Butler"
	case channelKindAgentDirect:
		if strings.TrimSpace(peer.Username) != "" {
			return fmt.Sprintf("%s chat", peer.Username)
		}
	}
	return defaultConversationTitle(channelKind)
}
