package handler

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/lea/echocenter/backend/internal/models"
	"github.com/lea/echocenter/backend/internal/api/websocket"
	apperrors "github.com/lea/echocenter/backend/pkg/errors"
)

// IngestMessageRequest represents a message ingestion request
type IngestMessageRequest struct {
	AgentID string `json:"agent_id" binding:"required"`
	Level   string `json:"level" binding:"required"`
	Content string `json:"content" binding:"required"`
}

// IngestMessage handles message ingestion from agents
func (h *Handler) IngestMessage(c *gin.Context) {
	var req IngestMessageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.respondWithError(c, http.StatusBadRequest, apperrors.Wrap(apperrors.ErrInvalidInput, "invalid request body", err))
		return
	}

	msg := &models.Message{
		AgentID:   req.AgentID,
		Level:     req.Level,
		Content:   req.Content,
		Timestamp: time.Now(),
	}

	if err := h.repo.CreateMessage(c.Request.Context(), msg); err != nil {
		h.respondWithError(c, http.StatusInternalServerError, err)
		return
	}

	// Broadcast via WebSocket
	if h.hub != nil {
		h.hub.Broadcast(&websocket.Message{
			Type:       websocket.MessageTypeSystemLog,
			SenderID:   msg.ID,
			SenderName: msg.AgentID,
			Payload:    msg,
			Timestamp:  msg.Timestamp.Format(time.RFC3339),
		})
	}

	c.JSON(http.StatusCreated, msg)
}
