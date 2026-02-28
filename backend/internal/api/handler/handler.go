package handler

import (
	"log"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/lea/echocenter/backend/internal/api/websocket"
	"github.com/lea/echocenter/backend/internal/auth"
	"github.com/lea/echocenter/backend/internal/butler"
	"github.com/lea/echocenter/backend/internal/models"
	"github.com/lea/echocenter/backend/internal/repository"
	apperrors "github.com/lea/echocenter/backend/pkg/errors"
)

type Handler struct {
	repo    repository.Repository
	authSvc auth.Service
	hub     websocket.Hub
}

func NewHandler(repo repository.Repository, authSvc auth.Service, hub websocket.Hub) *Handler {
	return &Handler{
		repo:    repo,
		authSvc: authSvc,
		hub:     hub,
	}
}

func (h *Handler) respondWithError(c *gin.Context, statusCode int, err error) {
	c.JSON(statusCode, gin.H{"error": err.Error()})
}

func (h *Handler) Login(c *gin.Context) {
	var req models.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.respondWithError(c, http.StatusBadRequest, apperrors.Wrap(apperrors.ErrInvalidInput, "invalid request body", err))
		return
	}

	user, err := h.repo.GetUserByUsername(c.Request.Context(), req.Username)
	if err != nil {
		h.respondWithError(c, http.StatusUnauthorized, apperrors.ErrInvalidCredentials)
		return
	}

	if err := h.authSvc.VerifyPassword(user.PasswordHash, req.Password); err != nil {
		h.respondWithError(c, http.StatusUnauthorized, apperrors.ErrInvalidCredentials)
		return
	}

	token, err := h.authSvc.GenerateToken(user.ID, user.Role)
	if err != nil {
		h.respondWithError(c, http.StatusInternalServerError, err)
		return
	}

	c.JSON(http.StatusOK, models.LoginResponse{Token: token, User: *user})
}

func (h *Handler) GetMessages(c *gin.Context) {
	messages, err := h.repo.GetMessages(c.Request.Context(), repository.MessageFilter{})
	if err != nil {
		h.respondWithError(c, http.StatusInternalServerError, err)
		return
	}

	c.JSON(http.StatusOK, messages)
}

func (h *Handler) IngestMessage(c *gin.Context) {
	var msg models.Message
	if err := c.ShouldBindJSON(&msg); err != nil {
		h.respondWithError(c, http.StatusBadRequest, apperrors.Wrap(apperrors.ErrInvalidInput, "invalid request body", err))
		return
	}

	if err := h.repo.CreateMessage(c.Request.Context(), &msg); err != nil {
		h.respondWithError(c, http.StatusInternalServerError, err)
		return
	}

	c.JSON(http.StatusCreated, msg)
}

func (h *Handler) GetAgents(c *gin.Context) {
	agents, err := h.repo.GetAgents(c.Request.Context())
	if err != nil {
		h.respondWithError(c, http.StatusInternalServerError, err)
		return
	}

	c.JSON(http.StatusOK, agents)
}

func (h *Handler) GetChatHistory(c *gin.Context) {
	peerIDStr := c.Param("peer_id")
	peerID, err := strconv.Atoi(peerIDStr)
	if err != nil {
		h.respondWithError(c, http.StatusBadRequest, apperrors.Wrap(apperrors.ErrInvalidInput, "invalid peer_id", err))
		return
	}

	userID, exists := c.Get("user_id")
	if !exists {
		h.respondWithError(c, http.StatusUnauthorized, apperrors.ErrUnauthorized)
		return
	}

	messages, err := h.repo.GetChatHistory(c.Request.Context(), userID.(int), peerID, 100)
	if err != nil {
		h.respondWithError(c, http.StatusInternalServerError, err)
		return
	}

	c.JSON(http.StatusOK, messages)
}

func (h *Handler) AuthResponse(c *gin.Context) {
	var req struct {
		ActionID string `json:"action_id"`
		Approved bool   `json:"approved"`
		StreamID string `json:"stream_id"`
		SenderID int    `json:"sender_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		h.respondWithError(c, http.StatusBadRequest, apperrors.Wrap(apperrors.ErrInvalidInput, "invalid request body", err))
		return
	}

	userID, exists := c.Get("user_id")
	if !exists {
		h.respondWithError(c, http.StatusUnauthorized, apperrors.ErrUnauthorized)
		return
	}

	log.Printf("[AuthResponse] Received request: action_id=%s, stream_id=%s, sender_id=%d, user_id=%v", req.ActionID, req.StreamID, req.SenderID, userID)

	streamID := req.StreamID
	if streamID == "" {
		streamID = req.ActionID
	}

	log.Printf("[AuthResponse] Using streamID: %s, executing command for user: %v", streamID, userID)

	butlerService := butler.GetButler()
	if butlerService != nil {
		butlerService.ExecutePendingCommand(c.Request.Context(), streamID, userID.(int), req.Approved)
	}

	c.JSON(http.StatusOK, gin.H{"status": "processed"})
}

func (h *Handler) CreateUser(c *gin.Context) {
	var user models.User
	if err := c.ShouldBindJSON(&user); err != nil {
		h.respondWithError(c, http.StatusBadRequest, apperrors.Wrap(apperrors.ErrInvalidInput, "invalid request body", err))
		return
	}

	if err := h.repo.CreateUser(c.Request.Context(), &user); err != nil {
		h.respondWithError(c, http.StatusInternalServerError, err)
		return
	}

	c.JSON(http.StatusCreated, user)
}

func (h *Handler) RegisterAgent(c *gin.Context) {
	var agent models.User
	if err := c.ShouldBindJSON(&agent); err != nil {
		h.respondWithError(c, http.StatusBadRequest, apperrors.Wrap(apperrors.ErrInvalidInput, "invalid request body", err))
		return
	}

	agent.Role = "AGENT"
	if err := h.repo.CreateUser(c.Request.Context(), &agent); err != nil {
		h.respondWithError(c, http.StatusInternalServerError, err)
		return
	}

	c.JSON(http.StatusCreated, agent)
}
