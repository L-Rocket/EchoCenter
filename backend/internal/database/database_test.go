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

	messages, err := GetLatestMessages(50)
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
