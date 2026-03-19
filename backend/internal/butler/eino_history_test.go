package butler

import (
	"testing"

	"github.com/cloudwego/eino/schema"
)

func TestSummarizePreparedMessages(t *testing.T) {
	messages := []*schema.Message{
		schema.SystemMessage("system prompt"),
		schema.SystemMessage("Conversation summary so far:\nolder context"),
		schema.UserMessage("hello there"),
		{Role: schema.Assistant, Content: "general kenobi"},
	}

	summary := summarizePreparedMessages(messages)

	if summary.TotalMessages != 4 {
		t.Fatalf("expected 4 total messages, got %d", summary.TotalMessages)
	}
	if !summary.SummaryInjected {
		t.Fatalf("expected summary injection to be detected")
	}
	if summary.SystemPromptChars == 0 {
		t.Fatalf("expected non-zero system prompt chars")
	}
	if summary.MemorySummaryChars == 0 {
		t.Fatalf("expected non-zero memory summary chars")
	}
	if summary.RecentMessages != 2 {
		t.Fatalf("expected 2 recent messages, got %d", summary.RecentMessages)
	}
	if len(summary.Messages) != 4 {
		t.Fatalf("expected 4 traced messages, got %d", len(summary.Messages))
	}
	if summary.Messages[2].Role != string(schema.User) {
		t.Fatalf("expected user role in preview, got %s", summary.Messages[2].Role)
	}
}

