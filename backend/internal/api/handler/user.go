package handler

import (
	"crypto/rand"
	"encoding/hex"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/lea/echocenter/backend/internal/models"
	apperrors "github.com/lea/echocenter/backend/pkg/errors"
)

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

// CreateUser handles user creation (admin only)
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

// RegisterAgent handles agent registration (admin only)
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
