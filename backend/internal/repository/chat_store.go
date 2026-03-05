package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"log"
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
		err := r.queryRowContext(ctx, "SELECT id, timestamp FROM chat_messages WHERE local_id = ?", msg.LocalID).Scan(&existingID, &existingTime)
		if err == nil {
			msg.ID = existingID
			msg.Timestamp = existingTime
			return nil
		}
	}

	timestamp := time.Now()

	var (
		err error
		id  int64
	)
	if msg.LocalID != "" {
		query := `INSERT INTO chat_messages (local_id, sender_id, receiver_id, type, content, timestamp) VALUES (?, ?, ?, ?, ?, ?)`
		id, err = r.insertAndReturnID(ctx, query, msg.LocalID, msg.SenderID, msg.ReceiverID, msgType, msg.Payload, timestamp)
	} else {
		query := `INSERT INTO chat_messages (sender_id, receiver_id, type, content, timestamp) VALUES (?, ?, ?, ?, ?)`
		id, err = r.insertAndReturnID(ctx, query, msg.SenderID, msg.ReceiverID, msgType, msg.Payload, timestamp)
	}

	if err != nil {
		return apperrors.Wrap(apperrors.ErrDatabase, "failed to save chat message", err)
	}

	msg.ID = int(id)
	msg.Timestamp = timestamp
	return nil
}

// GetChatHistory retrieves chat history between two users.
func (r *sqlRepository) GetChatHistory(ctx context.Context, user1ID, user2ID int, limit int) ([]models.ChatMessage, error) {
	query := `
		SELECT id, local_id, sender_id, receiver_id, type, content, timestamp
		FROM chat_messages
		WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
		ORDER BY timestamp ASC, id ASC
		LIMIT ?
	`
	rows, err := r.queryContext(ctx, query, user1ID, user2ID, user2ID, user1ID, limit)
	if err != nil {
		return nil, apperrors.Wrap(apperrors.ErrDatabase, "failed to query chat history", err)
	}
	defer rows.Close()

	var messages []models.ChatMessage
	for rows.Next() {
		var m models.ChatMessage
		var msgType sql.NullString
		var localID sql.NullString
		if err := rows.Scan(&m.ID, &localID, &m.SenderID, &m.ReceiverID, &msgType, &m.Payload, &m.Timestamp); err != nil {
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
