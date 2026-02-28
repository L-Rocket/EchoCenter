package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/lea/echocenter/backend/internal/api/websocket"
	apperrors "github.com/lea/echocenter/backend/pkg/errors"
)

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

// Ping handles health check
func (h *Handler) Ping(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"message": "pong"})
}
