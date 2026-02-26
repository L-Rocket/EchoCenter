package main

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/lea/echocenter/backend/auth"
	"golang.org/x/crypto/bcrypt"
)

func RespondWithError(c *gin.Context, code int, message string) {
	c.JSON(code, gin.H{"error": message})
}

func IngestMessage(c *gin.Context) {
	var msg Message
	if err := c.ShouldBindJSON(&msg); err != nil {
		RespondWithError(c, http.StatusBadRequest, err.Error())
		return
	}

	id, err := CreateMessage(msg)
	if err != nil {
		RespondWithError(c, http.StatusInternalServerError, "Failed to save message")
		return
	}

	msg.ID = int(id)
	msg.Timestamp = time.Now().UTC()

	c.JSON(http.StatusCreated, msg)
}

func GetMessages(c *gin.Context) {
	messages, err := GetLatestMessages(50)
	if err != nil {
		RespondWithError(c, http.StatusInternalServerError, "Failed to retrieve messages")
		return
	}

	c.JSON(http.StatusOK, messages)
}

func Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		RespondWithError(c, http.StatusBadRequest, "Invalid request")
		return
	}

	user, err := GetUserByUsername(req.Username)
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

	c.JSON(http.StatusOK, LoginResponse{
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

	err := CreateUser(input.Username, input.Password, input.Role)
	if err != nil {
		RespondWithError(c, http.StatusConflict, "Username already exists or creation failed")
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "User created successfully"})
}
