package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/lea/echocenter/backend/internal/auth"
	"github.com/lea/echocenter/backend/internal/database"
	"github.com/lea/echocenter/backend/internal/models"
	"github.com/lea/echocenter/backend/internal/websocket"
	"golang.org/x/crypto/bcrypt"
)

var wsHub *websocket.Hub

func SetHub(h *websocket.Hub) {
	wsHub = h
}

func RespondWithError(c *gin.Context, code int, message string) {
	c.JSON(code, gin.H{"error": message})
}

func IngestMessage(c *gin.Context) {
	var msg models.Message
	if err := c.ShouldBindJSON(&msg); err != nil {
		RespondWithError(c, http.StatusBadRequest, err.Error())
		return
	}

	id, err := database.CreateMessage(msg)
	if err != nil {
		RespondWithError(c, http.StatusInternalServerError, "Failed to save message")
		return
	}

	msg.ID = int(id)
	msg.Timestamp = time.Now().UTC()

	// Broadcast via WebSocket (NEW: Replace polling)
	if wsHub != nil {
		wsHub.Broadcast(&websocket.Message{
			Type:       "SYSTEM_LOG",
			SenderID:   msg.ID, // Use ID as a unique ref
			SenderName: msg.AgentID,
			Payload:    msg, // Send the full message object
			Timestamp:  msg.Timestamp.Format(time.RFC3339),
		})
	}

	c.JSON(http.StatusCreated, msg)
}

func GetMessages(c *gin.Context) {
	agentID := c.Query("agent_id")
	level := c.Query("level")
	query := c.Query("q")
	
	offsetStr := c.DefaultQuery("offset", "0")
	limitStr := c.DefaultQuery("limit", "50")

	var offset, limit int
	fmt.Sscanf(offsetStr, "%d", &offset)
	fmt.Sscanf(limitStr, "%d", &limit)

	messages, err := database.GetLatestMessages(agentID, level, query, offset, limit)
	if err != nil {
		RespondWithError(c, http.StatusInternalServerError, "Failed to retrieve messages")
		return
	}

	c.JSON(http.StatusOK, messages)
}

func Login(c *gin.Context) {
	var req models.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		RespondWithError(c, http.StatusBadRequest, "Invalid request")
		return
	}

	user, err := database.GetUserByUsername(req.Username)
	if err != nil {
		RespondWithError(c, http.StatusInternalServerError, "Login failed")
		return
	}

	if user == nil {
		RespondWithError(c, http.StatusUnauthorized, "Invalid credentials")
		return
	}

	err = bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password))
	if err != nil {
		RespondWithError(c, http.StatusUnauthorized, "Invalid credentials")
		return
	}

	token, err := auth.GenerateToken(user.ID, user.Role)
	if err != nil {
		RespondWithError(c, http.StatusInternalServerError, "Failed to generate token")
		return
	}

	c.JSON(http.StatusOK, models.LoginResponse{
		Token: token,
		User:  *user,
	})
}

func HandleCreateUser(c *gin.Context) {
	var input struct {
		Username string `json:"username" binding:"required"`
		Password string `json:"password" binding:"required"`
		Role     string `json:"role" binding:"required"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		RespondWithError(c, http.StatusBadRequest, err.Error())
		return
	}

	err := database.CreateUser(input.Username, input.Password, input.Role)
	if err != nil {
		RespondWithError(c, http.StatusConflict, "Username already exists or creation failed")
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "User created successfully"})
}

func HandleRegisterAgent(c *gin.Context) {
	var input struct {
		Username string `json:"username" binding:"required"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		RespondWithError(c, http.StatusBadRequest, err.Error())
		return
	}

	// Generate a secure random token
	tokenBytes := make([]byte, 24)
	if _, err := rand.Read(tokenBytes); err != nil {
		RespondWithError(c, http.StatusInternalServerError, "Failed to generate token")
		return
	}
	token := fmt.Sprintf("ec_agent_%s", hex.EncodeToString(tokenBytes))

	err := database.CreateAgent(input.Username, token)
	if err != nil {
		RespondWithError(c, http.StatusConflict, "Agent username already exists or creation failed")
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"username":  input.Username,
		"api_token": token,
	})
}

func HandleGetAgents(c *gin.Context) {
	agents, err := database.GetAgents()
	if err != nil {
		RespondWithError(c, http.StatusInternalServerError, "Failed to retrieve agents")
		return
	}
	c.JSON(http.StatusOK, agents)
}

func HandleWs(c *gin.Context) {
	token := c.Query("token")
	if token == "" {
		RespondWithError(c, http.StatusUnauthorized, "Token is required")
		return
	}

	// Try validating as JWT (Human User)
	var userID int
	var username string
	claims, err := auth.ValidateToken(token)
	if err == nil {
		userID = claims.UserID
		// We need username for the client. 
		// For MVP, we'll just use a placeholder or look it up if we really need it.
		// Actually, auth.Claims doesn't have username. 
		// I'll assume "User {ID}" for now or update claims.
		// Let's just use "User" for now.
		username = fmt.Sprintf("User_%d", userID)
	} else {
		// Try validating as Agent Token
		agent, err := database.GetAgentByToken(token)
		if err != nil || agent == nil {
			RespondWithError(c, http.StatusUnauthorized, "Invalid token")
			return
		}
		userID = agent.ID
		username = agent.Username
	}

	websocket.ServeWs(wsHub, c.Writer, c.Request, userID, username)
}

func HandleGetChatHistory(c *gin.Context) {
	peerIDStr := c.Param("peer_id")
	if peerIDStr == "" {
		RespondWithError(c, http.StatusBadRequest, "peer_id is required")
		return
	}

	// For MVP, we'll just parse it as int. 
	// In production, use a more robust way if IDs aren't sequential.
	var peerID int
	_, err := fmt.Sscanf(peerIDStr, "%d", &peerID)
	if err != nil {
		RespondWithError(c, http.StatusBadRequest, "Invalid peer_id")
		return
	}

	// Get current user ID from context (set by AuthMiddleware)
	userIDVal, exists := c.Get("user_id")
	if !exists {
		RespondWithError(c, http.StatusUnauthorized, "User context not found")
		return
	}
	userID := userIDVal.(int)

	history, err := database.GetChatHistory(userID, peerID, 50)
	if err != nil {
		RespondWithError(c, http.StatusInternalServerError, "Failed to retrieve chat history")
		return
	}

	c.JSON(http.StatusOK, history)
}
