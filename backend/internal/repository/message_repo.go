package repository

import (
	"context"
	"time"

	"github.com/lea/echocenter/backend/internal/models"
	apperrors "github.com/lea/echocenter/backend/pkg/errors"
)

// CreateMessage creates a new message
func (r *sqliteRepository) CreateMessage(ctx context.Context, msg *models.Message) error {
	query := `INSERT INTO messages (agent_id, level, content) VALUES (?, ?, ?)`
	result, err := r.db.ExecContext(ctx, query, msg.AgentID, msg.Level, msg.Content)
	if err != nil {
		return apperrors.Wrap(apperrors.ErrDatabase, "failed to create message", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		return apperrors.Wrap(apperrors.ErrDatabase, "failed to get last insert id", err)
	}

	msg.ID = int(id)
	msg.Timestamp = time.Now()
	return nil
}

// GetMessages retrieves messages with filtering
func (r *sqliteRepository) GetMessages(ctx context.Context, filter MessageFilter) ([]models.Message, error) {
	query := `SELECT id, agent_id, level, content, timestamp FROM messages WHERE 1=1`
	var args []interface{}

	if filter.AgentID != "" {
		query += ` AND agent_id = ?`
		args = append(args, filter.AgentID)
	}
	if filter.Level != "" {
		query += ` AND level = ?`
		args = append(args, filter.Level)
	}
	if filter.Query != "" {
		query += ` AND LOWER(content) LIKE LOWER(?)`
		args = append(args, "%"+filter.Query+"%")
	}

	query += ` ORDER BY timestamp DESC, id DESC LIMIT ? OFFSET ?`
	args = append(args, filter.Limit, filter.Offset)

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, apperrors.Wrap(apperrors.ErrDatabase, "failed to query messages", err)
	}
	defer rows.Close()

	var messages []models.Message
	for rows.Next() {
		var m models.Message
		if err := rows.Scan(&m.ID, &m.AgentID, &m.Level, &m.Content, &m.Timestamp); err != nil {
			return nil, apperrors.Wrap(apperrors.ErrDatabase, "failed to scan message", err)
		}
		messages = append(messages, m)
	}

	if err := rows.Err(); err != nil {
		return nil, apperrors.Wrap(apperrors.ErrDatabase, "error iterating messages", err)
	}

	return messages, nil
}
