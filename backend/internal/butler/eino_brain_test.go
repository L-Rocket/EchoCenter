package butler

import (
	"context"
	"testing"

	"github.com/lea/echocenter/backend/internal/models"
)

func TestButlerIngestion(t *testing.T) {
	// Empty baseURL triggers fallback to mock brain (safe-mode)
	brain := NewEinoBrain("", "test-token", "test-model")
	ctx := context.Background()

	t.Run("process info log", func(t *testing.T) {
		msg := models.Message{
			AgentID: "weather-bot",
			Level:   "INFO",
			Content: "Sunny",
		}
		thought, err := brain.ObserveLog(ctx, msg)
		if err != nil {
			t.Fatalf("Failed to observe log: %v", err)
		}
		if thought != "Log noted. (Safe-mode)" {
			t.Errorf("Expected 'Log noted. (Safe-mode)', got '%s'", thought)
		}
	})

	t.Run("process error log", func(t *testing.T) {
		msg := models.Message{
			AgentID: "weather-bot",
			Level:   "ERROR",
			Content: "Storm",
		}
		thought, err := brain.ObserveLog(ctx, msg)
		if err != nil {
			t.Fatalf("Failed to observe log: %v", err)
		}
		if thought != "I should probably check this error. (Safe-mode)" {
			t.Errorf("Expected intervention thought in safe-mode, got '%s'", thought)
		}
	})

	t.Run("direct chat safe-mode", func(t *testing.T) {
		reply, err := brain.Chat(ctx, "session-1", "Hello", "Test State")
		if err != nil {
			t.Fatalf("Chat failed: %v", err)
		}
		if reply != "I am currently operating in safe-mode. My intelligence core is offline, but I can still assist with basic system monitoring." {
			t.Errorf("Unexpected safe-mode reply: %s", reply)
		}
	})
}
