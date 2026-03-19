package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"log"
	"strings"
	"time"

	"github.com/lea/echocenter/backend/internal/models"
	apperrors "github.com/lea/echocenter/backend/pkg/errors"
)

// SaveChatMessage saves a chat message.
func (r *sqlRepository) SaveChatMessage(ctx context.Context, msg *models.ChatMessage) error {
	msgType := msg.Type
	if msgType == "" {
		msgType = "CHAT"
	}

	// 1. Idempotency check based on LocalID.
	if msg.LocalID != "" {
		var existingID int
		var existingTime time.Time
		var existingConversationID sql.NullInt64
		err := r.queryRowContext(ctx, "SELECT id, timestamp, conversation_id FROM chat_messages WHERE local_id = ?", msg.LocalID).Scan(&existingID, &existingTime, &existingConversationID)
		if err == nil {
			msg.ID = existingID
			msg.Timestamp = existingTime
			if existingConversationID.Valid {
				msg.ConversationID = int(existingConversationID.Int64)
			}
			return nil
		}
	}

	if msg.ConversationID <= 0 {
		thread, err := r.inferDirectConversation(ctx, msg.SenderID, msg.ReceiverID)
		if err != nil {
			return err
		}
		if thread != nil {
			msg.ConversationID = thread.ID
		}
	}

	timestamp := time.Now()

	var (
		err error
		id  int64
	)
	if msg.LocalID != "" {
		query := `INSERT INTO chat_messages (local_id, conversation_id, sender_id, receiver_id, type, content, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)`
		id, err = r.insertAndReturnID(ctx, query, msg.LocalID, nullableInt(msg.ConversationID), msg.SenderID, msg.ReceiverID, msgType, msg.Payload, timestamp)
	} else {
		query := `INSERT INTO chat_messages (conversation_id, sender_id, receiver_id, type, content, timestamp) VALUES (?, ?, ?, ?, ?, ?)`
		id, err = r.insertAndReturnID(ctx, query, nullableInt(msg.ConversationID), msg.SenderID, msg.ReceiverID, msgType, msg.Payload, timestamp)
	}

	if err != nil {
		return apperrors.Wrap(apperrors.ErrDatabase, "failed to save chat message", err)
	}

	msg.ID = int(id)
	msg.Timestamp = timestamp
	if msg.ConversationID > 0 {
		_ = r.touchConversationThread(ctx, msg.ConversationID, timestamp)
	}
	return nil
}

// GetChatHistory retrieves chat history between two users.
func (r *sqlRepository) GetChatHistory(ctx context.Context, user1ID, user2ID int, limit int) ([]models.ChatMessage, error) {
	thread, err := r.inferDirectConversation(ctx, user1ID, user2ID)
	if err != nil {
		return nil, err
	}
	if thread != nil {
		return r.GetConversationMessages(ctx, thread.ID, limit)
	}

	rows, err := r.queryContext(ctx, `
		SELECT id, local_id, conversation_id, sender_id, receiver_id, type, content, timestamp
		FROM chat_messages
		WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
		ORDER BY timestamp ASC, id ASC
		LIMIT ?
	`, user1ID, user2ID, user2ID, user1ID, limit)
	if err != nil {
		return nil, apperrors.Wrap(apperrors.ErrDatabase, "failed to query chat history", err)
	}
	defer rows.Close()
	return scanChatMessages(rows)
}

func nullableInt(v int) any {
	if v <= 0 {
		return nil
	}
	return v
}

func scanChatMessages(rows *sql.Rows) ([]models.ChatMessage, error) {
	var messages []models.ChatMessage
	for rows.Next() {
		var m models.ChatMessage
		var msgType sql.NullString
		var localID sql.NullString
		var conversationID sql.NullInt64
		if err := rows.Scan(&m.ID, &localID, &conversationID, &m.SenderID, &m.ReceiverID, &msgType, &m.Payload, &m.Timestamp); err != nil {
			return nil, apperrors.Wrap(apperrors.ErrDatabase, "failed to scan chat message", err)
		}
		if msgType.Valid {
			m.Type = msgType.String
		} else {
			m.Type = "CHAT"
		}
		if localID.Valid {
			m.LocalID = localID.String
		}
		if conversationID.Valid {
			m.ConversationID = int(conversationID.Int64)
		}
		messages = append(messages, m)
	}
	if err := rows.Err(); err != nil {
		return nil, apperrors.Wrap(apperrors.ErrDatabase, "error iterating chat messages", err)
	}
	return messages, nil
}

// UpdateAuthRequestStatus updates the status of an AUTH_REQUEST message in chat history.
func (r *sqlRepository) UpdateAuthRequestStatus(ctx context.Context, actionID string, status string) error {
	rows, err := r.queryContext(ctx, "SELECT id, content FROM chat_messages WHERE type = 'AUTH_REQUEST'")
	if err != nil {
		return apperrors.Wrap(apperrors.ErrDatabase, "failed to query AUTH_REQUEST message", err)
	}

	type updateOp struct {
		id      int
		content string
	}
	var updates []updateOp

	for rows.Next() {
		var id int
		var content string
		if err := rows.Scan(&id, &content); err != nil {
			continue
		}

		var payload map[string]any
		if err := json.Unmarshal([]byte(content), &payload); err != nil {
			continue
		}

		if aid, ok := payload["action_id"].(string); ok && aid == actionID {
			payload["status"] = status
			newContent, _ := json.Marshal(payload)
			updates = append(updates, updateOp{id: id, content: string(newContent)})
		}
	}
	rows.Close() // Close rows before updates to prevent SQLITE_BUSY.

	for _, op := range updates {
		_, err = r.execContext(ctx, "UPDATE chat_messages SET content = ? WHERE id = ?", op.content, op.id)
		if err != nil {
			log.Printf("[Repository] Failed to update message %d: %v", op.id, err)
		} else {
			log.Printf("[Repository] Successfully updated AuthRequest %s to %s (MsgID: %d)", actionID, status, op.id)
		}
	}

	return nil
}

// ExpirePendingAuthRequests marks stale AUTH_REQUEST records as EXPIRED.
// This prevents old pending approvals from repeatedly showing up after restarts.
func (r *sqlRepository) ExpirePendingAuthRequests(ctx context.Context) (int, error) {
	rows, err := r.queryContext(ctx, "SELECT id, content FROM chat_messages WHERE type = 'AUTH_REQUEST'")
	if err != nil {
		return 0, apperrors.Wrap(apperrors.ErrDatabase, "failed to query AUTH_REQUEST messages", err)
	}
	defer rows.Close()

	type updateOp struct {
		id      int
		content string
	}
	var updates []updateOp

	for rows.Next() {
		var id int
		var content string
		if err := rows.Scan(&id, &content); err != nil {
			continue
		}

		var payload map[string]any
		if err := json.Unmarshal([]byte(content), &payload); err != nil {
			continue
		}

		status, _ := payload["status"].(string)
		if strings.EqualFold(strings.TrimSpace(status), "PENDING") {
			payload["status"] = "EXPIRED"
			newContent, _ := json.Marshal(payload)
			updates = append(updates, updateOp{id: id, content: string(newContent)})
		}
	}

	if err := rows.Err(); err != nil {
		return 0, apperrors.Wrap(apperrors.ErrDatabase, "failed iterating AUTH_REQUEST messages", err)
	}

	updated := 0
	for _, op := range updates {
		if _, err := r.execContext(ctx, "UPDATE chat_messages SET content = ? WHERE id = ?", op.content, op.id); err != nil {
			log.Printf("[Repository] Failed to expire AUTH_REQUEST message %d: %v", op.id, err)
			continue
		}
		updated++
	}

	return updated, nil
}
