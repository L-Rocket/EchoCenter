package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/lea/echocenter/backend/internal/auth"
	"github.com/lea/echocenter/backend/internal/models"
	"github.com/lea/echocenter/backend/internal/repository"
	"github.com/lea/echocenter/backend/internal/websocket"
	apperrors "github.com/lea/echocenter/backend/pkg/errors"
)

// Handler holds all HTTP handlers
type Handler struct {
	repo    repository.Repository
	authSvc auth.Service
	hub     websocket.Hub
}

// NewHandler creates a new handler instance
func NewHandler(repo repository.Repository, authSvc auth.Service, hub websocket.Hub) *Handler {
	return &Handler{
		repo:    repo,
		authSvc: authSvc,
		hub:     hub,
	}
}

// ErrorResponse represents an error response
type ErrorResponse struct {
	Error   string `json:"error"`
	Details string `json:"details,omitempty"`
}

// respondWithError sends an error response
func (h *Handler) respondWithError(c *gin.Context, status int, err error) {
	response := ErrorResponse{Error: "internal server error"}

	var appErr *apperrors.AppError
	if apperrors.As(err, &appErr) {
		switch {
		case apperrors.Is(err, apperrors.ErrNotFound):
			status = http.StatusNotFound
			response.Error = "resource not found"
		case apperrors.Is(err, apperrors.ErrInvalidInput), apperrors.Is(err, apperrors.ErrValidation):
			status = http.StatusBadRequest
			response.Error = "invalid request"
		case apperrors.Is(err, apperrors.ErrUnauthorized), apperrors.Is(err, apperrors.ErrTokenExpired), apperrors.Is(err, apperrors.ErrTokenInvalid):
			status = http.StatusUnauthorized
			response.Error = "unauthorized"
		case apperrors.Is(err, apperrors.ErrForbidden):
			status = http.StatusForbidden
			response.Error = "forbidden"
		case apperrors.Is(err, apperrors.ErrConflict):
			status = http.StatusConflict
			response.Error = "conflict"
		default:
			status = http.StatusInternalServerError
		}
		response.Details = appErr.Error()
	}

	c.JSON(status, response)
}

// getUserIDFromContext extracts user ID from gin context
func getUserIDFromContext(c *gin.Context) (int, bool) {
	userID, exists := c.Get("user_id")
	if !exists {
		return 0, false
	}
	id, ok := userID.(int)
	return id, ok
}

// getUserRoleFromContext extracts user role from gin context
func getUserRoleFromContext(c *gin.Context) (string, bool) {
	userRole, exists := c.Get("user_role")
	if !exists {
		return "", false
	}
	role, ok := userRole.(string)
	return role, ok
}

// IngestMessageRequest represents a message ingestion request
type IngestMessageRequest struct {
	AgentID string `json:"agent_id" binding:"required"`
	Level   string `json:"level" binding:"required"`
	Content string `json:"content" binding:"required"`
}

// IngestMessage handles message ingestion
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

// LoginRequest represents a login request
type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

// LoginResponse represents a login response
type LoginResponse struct {
	Token string      `json:"token"`
	User  models.User `json:"user"`
}

// Login handles user login
func (h *Handler) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.respondWithError(c, http.StatusBadRequest, apperrors.Wrap(apperrors.ErrInvalidInput, "invalid request body", err))
		return
	}

	user, err := h.repo.GetUserByUsername(c.Request.Context(), req.Username)
	if err != nil {
		h.respondWithError(c, http.StatusInternalServerError, err)
		return
	}

	if user == nil {
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

	// Don't expose password hash
	user.PasswordHash = ""

	c.JSON(http.StatusOK, LoginResponse{
		Token: token,
		User:  *user,
	})
}

// CreateUserRequest represents a user creation request
type CreateUserRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required,min=6"`
	Role     string `json:"role" binding:"required,oneof=ADMIN MEMBER"`
}

// CreateUser handles user creation
func (h *Handler) CreateUser(c *gin.Context) {
	var req CreateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.respondWithError(c, http.StatusBadRequest, apperrors.Wrap(apperrors.ErrInvalidInput, "invalid request body", err))
		return
	}

	hashedPassword, err := h.authSvc.HashPassword(req.Password)
	if err != nil {
		h.respondWithError(c, http.StatusInternalServerError, err)
		return
	}

	user := &models.User{
		Username:     req.Username,
		PasswordHash: hashedPassword,
		Role:         req.Role,
	}

	if err := h.repo.CreateUser(c.Request.Context(), user); err != nil {
		h.respondWithError(c, http.StatusConflict, err)
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "user created successfully"})
}

// RegisterAgentRequest represents an agent registration request
type RegisterAgentRequest struct {
	Username string `json:"username" binding:"required"`
}

// RegisterAgentResponse represents an agent registration response
type RegisterAgentResponse struct {
	Username string `json:"username"`
	APIToken string `json:"api_token"`
}

// RegisterAgent handles agent registration
func (h *Handler) RegisterAgent(c *gin.Context) {
	var req RegisterAgentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.respondWithError(c, http.StatusBadRequest, apperrors.Wrap(apperrors.ErrInvalidInput, "invalid request body", err))
		return
	}

	// Generate a secure random token
	tokenBytes := make([]byte, 24)
	if _, err := rand.Read(tokenBytes); err != nil {
		h.respondWithError(c, http.StatusInternalServerError, apperrors.Wrap(apperrors.ErrInternal, "failed to generate token", err))
		return
	}
	token := "ec_agent_" + hex.EncodeToString(tokenBytes)

	if err := h.repo.CreateAgent(c.Request.Context(), req.Username, token); err != nil {
		h.respondWithError(c, http.StatusConflict, err)
		return
	}

	c.JSON(http.StatusCreated, RegisterAgentResponse{
		Username: req.Username,
		APIToken: token,
	})
}

// GetAgents handles agent retrieval
func (h *Handler) GetAgents(c *gin.Context) {
	agents, err := h.repo.GetAgents(c.Request.Context())
	if err != nil {
		h.respondWithError(c, http.StatusInternalServerError, err)
		return
	}

	c.JSON(http.StatusOK, agents)
}

// HandleWS handles WebSocket connections
func (h *Handler) HandleWS(c *gin.Context) {
	token := c.Query("token")
	if token == "" {
		h.respondWithError(c, http.StatusUnauthorized, apperrors.New(apperrors.ErrUnauthorized, "token is required"))
		return
	}

	// Try validating as JWT (Human User)
	var userID int
	var username string
	var role string

	claims, err := h.authSvc.ValidateToken(token)
	if err == nil {
		userID = claims.UserID
		role = claims.Role

		// Get username from repository
		user, err := h.repo.GetUserByID(c.Request.Context(), userID)
		if err != nil {
			h.respondWithError(c, http.StatusInternalServerError, err)
			return
		}
		if user != nil {
			username = user.Username
		} else {
			username = "User_" + strconv.Itoa(userID)
		}
	} else {
		// Try validating as Agent Token
		agent, err := h.repo.GetAgentByToken(c.Request.Context(), token)
		if err != nil {
			h.respondWithError(c, http.StatusInternalServerError, err)
			return
		}
		if agent == nil {
			h.respondWithError(c, http.StatusUnauthorized, apperrors.ErrInvalidCredentials)
			return
		}
		userID = agent.ID
		username = agent.Username
		role = agent.Role
	}

	upgrader := websocket.NewUpgrader(websocket.DefaultUpgraderConfig())
	if err := websocket.ServeWS(c.Writer, c.Request, h.hub, upgrader, userID, username, role); err != nil {
		h.respondWithError(c, http.StatusInternalServerError, err)
		return
	}
}

// GetChatHistory handles chat history retrieval
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

	// Enrich Butler messages with current authorization status
	for i, msg := range history {
		var payload map[string]interface{}
		if err := json.Unmarshal([]byte(msg.Payload), &payload); err == nil {
			if actionID, ok := payload["action_id"].(string); ok {
				auth, _ := h.repo.GetAuthorization(c.Request.Context(), actionID)
				if auth != nil {
					payload["status"] = auth.Status
					newPayload, _ := json.Marshal(payload)
					history[i].Payload = string(newPayload)
				}
			}
		}
	}

	c.JSON(http.StatusOK, history)
}

// AuthResponseRequest represents an authorization response request
type AuthResponseRequest struct {
	ActionID string `json:"action_id" binding:"required"`
	Approved bool   `json:"approved"`
}

// AuthResponse handles authorization responses
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

	if err := h.repo.UpdateAuthorizationStatus(c.Request.Context(), req.ActionID, status); err != nil {
		h.respondWithError(c, http.StatusInternalServerError, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":    "resolved",
		"action_id": req.ActionID,
		"approved":  req.Approved,
	})
}

// Ping handles health check
func (h *Handler) Ping(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"message": "pong"})
}
