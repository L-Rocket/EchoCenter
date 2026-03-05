package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/lea/echocenter/backend/internal/models"
	apperrors "github.com/lea/echocenter/backend/pkg/errors"
)

func (h *Handler) ensureDevMockAllowed(c *gin.Context) bool {
	if h.appEnv == "production" || h.appEnv == "prod" {
		h.respondWithError(c, http.StatusForbidden, apperrors.New(apperrors.ErrForbidden, "mock endpoints are disabled in production"))
		return false
	}
	return true
}

func (h *Handler) DevMockReset(c *gin.Context) {
	if !h.ensureDevMockAllowed(c) {
		return
	}
	if h.initialAdminUser == "" || h.initialAdminPassword == "" {
		h.respondWithError(c, http.StatusInternalServerError, apperrors.New(apperrors.ErrInternal, "INITIAL_ADMIN_USER and INITIAL_ADMIN_PASS are required for mock reset"))
		return
	}

	if err := h.repo.ResetMockData(c.Request.Context()); err != nil {
		h.respondWithError(c, http.StatusInternalServerError, err)
		return
	}

	if err := h.repo.InitializeAdmin(c.Request.Context(), h.initialAdminUser, h.initialAdminPassword, h.bcryptCost); err != nil {
		h.respondWithError(c, http.StatusInternalServerError, err)
		return
	}

	if _, err := h.repo.InitializeButler(c.Request.Context()); err != nil {
		h.respondWithError(c, http.StatusInternalServerError, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "reset"})
}

func (h *Handler) DevMockInsertChat(c *gin.Context) {
	if !h.ensureDevMockAllowed(c) {
		return
	}

	var req struct {
		SenderUsername   string `json:"sender_username" binding:"required"`
		ReceiverUsername string `json:"receiver_username" binding:"required"`
		Type             string `json:"type"`
		Content          string `json:"content" binding:"required"`
		LocalID          string `json:"local_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		h.respondWithError(c, http.StatusBadRequest, apperrors.Wrap(apperrors.ErrInvalidInput, "invalid request body", err))
		return
	}

	sender, err := h.repo.GetUserByUsername(c.Request.Context(), req.SenderUsername)
	if err != nil {
		h.respondWithError(c, http.StatusInternalServerError, err)
		return
	}
	if sender == nil {
		h.respondWithError(c, http.StatusBadRequest, apperrors.New(apperrors.ErrInvalidInput, "sender user not found"))
		return
	}

	receiver, err := h.repo.GetUserByUsername(c.Request.Context(), req.ReceiverUsername)
	if err != nil {
		h.respondWithError(c, http.StatusInternalServerError, err)
		return
	}
	if receiver == nil {
		h.respondWithError(c, http.StatusBadRequest, apperrors.New(apperrors.ErrInvalidInput, "receiver user not found"))
		return
	}

	msgType := req.Type
	if msgType == "" {
		msgType = "CHAT"
	}

	msg := &models.ChatMessage{
		LocalID:    req.LocalID,
		SenderID:   sender.ID,
		ReceiverID: receiver.ID,
		Type:       msgType,
		Payload:    req.Content,
	}
	if err := h.repo.SaveChatMessage(c.Request.Context(), msg); err != nil {
		h.respondWithError(c, http.StatusInternalServerError, err)
		return
	}

	c.JSON(http.StatusCreated, gin.H{"id": msg.ID})
}

func (h *Handler) DevGetAgentToken(c *gin.Context) {
	if !h.ensureDevMockAllowed(c) {
		return
	}

	username := c.Param("username")
	user, err := h.repo.GetUserByUsername(c.Request.Context(), username)
	if err != nil {
		h.respondWithError(c, http.StatusInternalServerError, err)
		return
	}
	if user == nil {
		h.respondWithError(c, http.StatusNotFound, apperrors.New(apperrors.ErrNotFound, "user not found"))
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"username":  user.Username,
		"role":      user.Role,
		"api_token": user.APIToken,
	})
}
