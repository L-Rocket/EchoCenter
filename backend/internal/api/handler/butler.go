package handler

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/lea/echocenter/backend/internal/butler"
	"github.com/lea/echocenter/backend/internal/models"
	"github.com/lea/echocenter/backend/internal/repository"
	apperrors "github.com/lea/echocenter/backend/pkg/errors"
)

// GetChatHistory handles chat history retrieval with Butler
func (h *Handler) GetChatHistory(c *gin.Context) {
	peerIDStr := c.Param("peer_id")
	if peerIDStr == "" {
		h.respondWithError(c, http.StatusBadRequest, apperrors.New(apperrors.ErrInvalidInput, "peer_id is required"))
		return
	}

	peerID, err := strconv.Atoi(peerIDStr)
	if err != nil {
		h.respondWithError(c, http.StatusBadRequest, apperrors.Wrap(apperrors.ErrInvalidInput, "invalid peer_id", err))
		return
	}

	userID, ok := getUserIDFromContext(c)
	if !ok {
		h.respondWithError(c, http.StatusUnauthorized, apperrors.New(apperrors.ErrUnauthorized, "user context not found"))
		return
	}

	history, err := h.repo.GetChatHistory(c.Request.Context(), userID, peerID, 50)
	if err != nil {
		h.respondWithError(c, http.StatusInternalServerError, err)
		return
	}

	// Filter out AUTH_RESPONSE messages to avoid duplicate cards
	filteredHistory := make([]models.ChatMessage, 0, len(history))
	for _, msg := range history {
		if msg.Type != "AUTH_RESPONSE" {
			filteredHistory = append(filteredHistory, msg)
		}
	}

	// Enrich Butler messages with current authorization status
	for i, msg := range filteredHistory {
		var payload map[string]interface{}
		if err := json.Unmarshal([]byte(msg.Payload), &payload); err == nil {
			if actionID, ok := payload["action_id"].(string); ok {
				auth, _ := h.repo.GetAuthorization(c.Request.Context(), actionID)
				if auth != nil {
					payload["status"] = auth.Status
					newPayload, _ := json.Marshal(payload)
					filteredHistory[i].Payload = string(newPayload)
				}
			}
		}
	}

	c.JSON(http.StatusOK, filteredHistory)
}

// AuthResponseRequest represents an authorization response request
type AuthResponseRequest struct {
	ActionID string `json:"action_id" binding:"required"`
	Approved bool   `json:"approved"`
}

// AuthResponse handles authorization responses for Butler actions
func (h *Handler) AuthResponse(c *gin.Context) {
	var req AuthResponseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.respondWithError(c, http.StatusBadRequest, apperrors.Wrap(apperrors.ErrInvalidInput, "invalid request body", err))
		return
	}

	status := "REJECTED"
	if req.Approved {
		status = "APPROVED"
	}

	// Try to update authorization status, but don't fail if it doesn't exist
	// (it might be a pending command without a stored authorization)
	if err := h.repo.UpdateAuthorizationStatus(c.Request.Context(), req.ActionID, status); err != nil {
		// Only log the error, don't return - we still want to try resolving the action
		log.Printf("[AuthResponse] Note: Could not update authorization status for %s: %v", req.ActionID, err)
	}

	// Get current user ID from context
	userID, exists := c.Get("user_id")
	if !exists {
		h.respondWithError(c, http.StatusUnauthorized, apperrors.New(apperrors.ErrUnauthorized, "user not authenticated"))
		return
	}
	senderID := userID.(int)

	// First try to resolve as a tool action
	resolved := butler.ResolveAction(req.ActionID, req.Approved)

	// If not resolved as tool action, try as a pending command
	if !resolved {
		resolved = butler.ExecutePendingCommandByID(c.Request.Context(), req.ActionID, senderID, req.Approved)
	}

	if !resolved {
		log.Printf("[AuthResponse] Warning: Action %s was not found in pending actions or commands", req.ActionID)
	}

	c.JSON(http.StatusOK, gin.H{
		"status":    "resolved",
		"action_id": req.ActionID,
		"approved":  req.Approved,
	})
}

// GetMessagesRequest represents a message query request
type GetMessagesRequest struct {
	AgentID string `form:"agent_id"`
	Level   string `form:"level"`
	Query   string `form:"q"`
	Offset  int    `form:"offset,default=0"`
	Limit   int    `form:"limit,default=50"`
}

// GetMessages handles message retrieval
func (h *Handler) GetMessages(c *gin.Context) {
	var req GetMessagesRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		h.respondWithError(c, http.StatusBadRequest, apperrors.Wrap(apperrors.ErrInvalidInput, "invalid query parameters", err))
		return
	}

	filter := repository.MessageFilter{
		AgentID: req.AgentID,
		Level:   req.Level,
		Query:   req.Query,
		Offset:  req.Offset,
		Limit:   req.Limit,
	}

	messages, err := h.repo.GetMessages(c.Request.Context(), filter)
	if err != nil {
		h.respondWithError(c, http.StatusInternalServerError, err)
		return
	}

	c.JSON(http.StatusOK, messages)
}
