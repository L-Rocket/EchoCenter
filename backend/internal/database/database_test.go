package database

import (
	"os"
	"testing"
	"github.com/lea/echocenter/backend/internal/models"
)

func TestMain(m *testing.M) {
	// Setup: Initialize DB for testing
	// We'll use a temporary test database
	dbFile := "./echocenter_test.db"
	InitDBWithFile(dbFile)

	code := m.Run()

	// Teardown
	db.Close()
	os.Remove(dbFile)

	os.Exit(code)
}

// Helper to init DB with specific file
func InitDBWithFile(file string) {
	InitDBPath(file)
}

func TestCreateMessage(t *testing.T) {
	msg := models.Message{
		AgentID: "test-agent",
		Level:   "INFO",
		Content: "Test content",
	}

	id, err := CreateMessage(msg)
	if err != nil {
		t.Fatalf("Failed to create message: %v", id)
	}

	if id <= 0 {
		t.Errorf("Expected positive ID, got %d", id)
	}
}

func TestGetLatestMessages(t *testing.T) {
	// Seed some messages
	for i := 0; i < 60; i++ {
		CreateMessage(models.Message{
			AgentID: "agent-1",
			Level:   "INFO",
			Content: "Content",
		})
	}

	messages, err := GetLatestMessages("", "", "", 0, 50)
	if err != nil {
		t.Fatalf("Failed to get latest messages: %v", err)
	}

	if len(messages) != 50 {
		t.Errorf("Expected 50 messages, got %d", len(messages))
	}

	// Verify order (newest first - though we didn't mock time, ID should be descending)
	if messages[0].ID < messages[49].ID {
		t.Errorf("Expected reverse chronological order (by ID), but first ID %d is smaller than last ID %d", messages[0].ID, messages[49].ID)
	}
}

func TestGetFilteredMessages(t *testing.T) {
	// Seed specific messages
	CreateMessage(models.Message{AgentID: "weather-bot", Level: "INFO", Content: "Sunny day"})
	CreateMessage(models.Message{AgentID: "weather-bot", Level: "ERROR", Content: "Storm incoming"})
	CreateMessage(models.Message{AgentID: "security-bot", Level: "ERROR", Content: "Intrusion detected"})

	t.Run("filter by agent", func(t *testing.T) {
		msgs, _ := GetLatestMessages("security-bot", "", "", 0, 10)
		if len(msgs) != 1 || msgs[0].AgentID != "security-bot" {
			t.Errorf("Expected 1 security-bot message, got %d", len(msgs))
		}
	})

	t.Run("filter by level", func(t *testing.T) {
		msgs, _ := GetLatestMessages("", "ERROR", "", 0, 10)
		if len(msgs) < 2 {
			t.Errorf("Expected at least 2 ERROR messages, got %d", len(msgs))
		}
		for _, m := range msgs {
			if m.Level != "ERROR" {
				t.Errorf("Expected ERROR level, got %s", m.Level)
			}
		}
	})

	t.Run("filter by query", func(t *testing.T) {
		msgs, _ := GetLatestMessages("", "", "Storm", 0, 10)
		if len(msgs) != 1 || msgs[0].Content != "Storm incoming" {
			t.Errorf("Expected 'Storm incoming' message, got %d results", len(msgs))
		}
	})

	t.Run("pagination offset", func(t *testing.T) {
		// We have many messages from TestGetLatestMessages
		msgs1, _ := GetLatestMessages("", "", "", 0, 10)
		msgs2, _ := GetLatestMessages("", "", "", 10, 10)
		
		if msgs1[0].ID == msgs2[0].ID {
			t.Error("Offset 10 should return different messages than offset 0")
		}
	})
}

func TestChatHistory(t *testing.T) {
	senderID := 1
	receiverID := 2
	content := "Hello persistent world"

	err := SaveChatMessage(senderID, receiverID, content)
	if err != nil {
		t.Fatalf("Failed to save chat message: %v", err)
	}

	history, err := GetChatHistory(senderID, receiverID, 10)
	if err != nil {
		t.Fatalf("Failed to get chat history: %v", err)
	}

	if len(history) == 0 {
		t.Fatal("Expected history, got none")
	}

	if history[0].Payload != content {
		t.Errorf("Expected content '%s', got '%s'", content, history[0].Payload)
	}
}

func TestButlerAuthorization(t *testing.T) {
	actionID := "test-uuid-123"
	butlerID := 1
	targetID := 2
	command := "RESTART"
	reasoning := "System update"

	// Test Save
	err := SaveAuthorization(actionID, butlerID, targetID, command, reasoning)
	if err != nil {
		t.Fatalf("Failed to save auth: %v", err)
	}

	// Test Get
	auth, err := GetAuthorization(actionID)
	if err != nil || auth == nil {
		t.Fatalf("Failed to retrieve auth: %v", err)
	}

	if auth.Status != "PENDING" {
		t.Errorf("Expected PENDING, got %s", auth.Status)
	}

	// Test Update
	err = UpdateAuthorizationStatus(actionID, "APPROVED")
	if err != nil {
		t.Fatalf("Failed to update status: %v", err)
	}

	auth, _ = GetAuthorization(actionID)
	if auth.Status != "APPROVED" {
		t.Errorf("Expected APPROVED, got %s", auth.Status)
	}
}
