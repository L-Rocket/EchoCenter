package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/lea/echocenter/backend/internal/auth"
	"github.com/lea/echocenter/backend/internal/repository"
	"github.com/lea/echocenter/backend/internal/api/websocket"
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
