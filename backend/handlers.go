package main

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
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
	msg.Timestamp = time.Now().UTC() // Approximate for response

	c.JSON(http.StatusCreated, msg)
}

func GetMessages(c *gin.Context) {
	// Simple limit parsing for MVP
	messages, err := GetLatestMessages(50)
	if err != nil {
		RespondWithError(c, http.StatusInternalServerError, "Failed to retrieve messages")
		return
	}

	c.JSON(http.StatusOK, messages)
}
