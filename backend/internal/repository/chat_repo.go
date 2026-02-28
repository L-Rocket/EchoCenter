package repository

import (
	"context"
	"database/sql"

	"github.com/lea/echocenter/backend/internal/models"
	apperrors "github.com/lea/echocenter/backend/pkg/errors"
)

// SaveChatMessage saves a chat message
func (r *sqliteRepository) SaveChatMessage(ctx context.Context, msg *models.ChatMessage) error {
	query := `INSERT INTO chat_messages (sender_id, receiver_id, type, content) VALUES (?, ?, ?, ?)`
	msgType := msg.Type
	if msgType == "" {
		msgType = "CHAT"
	}
	_, err := r.db.ExecContext(ctx, query, msg.SenderID, msg.ReceiverID, msgType, msg.Payload)
	if err != nil {
		return apperrors.Wrap(apperrors.ErrDatabase, "failed to save chat message", err)
	}
	return nil
}

// GetChatHistory retrieves chat history between two users
func (r *sqliteRepository) GetChatHistory(ctx context.Context, user1ID, user2ID int, limit int) ([]models.ChatMessage, error) {
	query := `
		SELECT id, sender_id, receiver_id, type, content, timestamp 
		FROM chat_messages 
		WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
		ORDER BY timestamp ASC 
		LIMIT ?
	`
	rows, err := r.db.QueryContext(ctx, query, user1ID, user2ID, user2ID, user1ID, limit)
	if err != nil {
		return nil, apperrors.Wrap(apperrors.ErrDatabase, "failed to query chat history", err)
	}
	defer rows.Close()

	var messages []models.ChatMessage
	for rows.Next() {
		var m models.ChatMessage
		var msgType sql.NullString
		if err := rows.Scan(&m.ID, &m.SenderID, &m.ReceiverID, &msgType, &m.Payload, &m.Timestamp); err != nil {
			return nil, apperrors.Wrap(apperrors.ErrDatabase, "failed to scan chat message", err)
		}
		if msgType.Valid {
			m.Type = msgType.String
		} else {
			m.Type = "CHAT"
		}
		messages = append(messages, m)
	}

	if err := rows.Err(); err != nil {
		return nil, apperrors.Wrap(apperrors.ErrDatabase, "error iterating chat messages", err)
	}

	return messages, nil
}
