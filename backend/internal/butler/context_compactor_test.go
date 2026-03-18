package butler

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/cloudwego/eino/schema"
)

type stubCompactor struct {
	summary string
	err     error
	calls   int
	lastReq contextCompactionRequest
}

func (s *stubCompactor) Compact(_ context.Context, req contextCompactionRequest) (string, error) {
	s.calls++
	s.lastReq = req
	if s.err != nil {
		return "", s.err
	}
	return s.summary, nil
}

func newTestBrain(compactor contextCompactor, cfg ContextCompactionConfig) *EinoBrain {
	return &EinoBrain{
		compactor:  compactor,
		compaction: cfg.withDefaults(),
		history:    make(map[string]*conversationState),
	}
}

func TestPrepareConversationCompactsOlderMessages(t *testing.T) {
	compactor := &stubCompactor{summary: "Goals: keep feature planning concise."}
	brain := newTestBrain(compactor, ContextCompactionConfig{
		Enabled:         true,
		TriggerMessages: 2,
		RecentWindow:    1,
	})

	sessionID := "user_1"
	brain.appendHistory(sessionID,
		schema.UserMessage("first request"),
		&schema.Message{Role: schema.Assistant, Content: "first answer"},
	)

	msgs := brain.prepareConversation(context.Background(), sessionID, "second request", "Agent A online")

	if compactor.calls != 1 {
		t.Fatalf("expected compactor to run once, got %d", compactor.calls)
	}
	if len(compactor.lastReq.Messages) != 2 {
		t.Fatalf("expected 2 messages to compact, got %d", len(compactor.lastReq.Messages))
	}

	state := brain.history[sessionID]
	if state == nil {
		t.Fatalf("expected session state to exist")
	}
	if state.Summary != compactor.summary {
		t.Fatalf("expected summary to be stored, got %q", state.Summary)
	}
	if len(state.RecentMessages) != 1 || state.RecentMessages[0].Content != "second request" {
		t.Fatalf("expected only latest message to remain recent, got %#v", state.RecentMessages)
	}

	if len(msgs) != 3 {
		t.Fatalf("expected system + summary + latest message, got %d messages", len(msgs))
	}
	if msgs[0].Role != schema.System || !strings.Contains(msgs[0].Content, "CURRENT SYSTEM STATE") {
		t.Fatalf("expected first message to be runtime system prompt")
	}
	if msgs[1].Role != schema.System || !strings.Contains(msgs[1].Content, compactor.summary) {
		t.Fatalf("expected second message to contain compacted summary")
	}
	if msgs[2].Content != "second request" {
		t.Fatalf("expected latest user message to be preserved, got %q", msgs[2].Content)
	}
}

func TestPrepareConversationFallsBackWhenCompactionFails(t *testing.T) {
	compactor := &stubCompactor{err: errors.New("boom")}
	brain := newTestBrain(compactor, ContextCompactionConfig{
		Enabled:         true,
		TriggerMessages: 2,
		RecentWindow:    1,
	})

	sessionID := "user_2"
	brain.appendHistory(sessionID,
		schema.UserMessage("message one"),
		&schema.Message{Role: schema.Assistant, Content: "message two"},
	)

	msgs := brain.prepareConversation(context.Background(), sessionID, "message three", "")

	if compactor.calls != 1 {
		t.Fatalf("expected compactor attempt, got %d", compactor.calls)
	}

	state := brain.history[sessionID]
	if state == nil {
		t.Fatalf("expected session state to exist")
	}
	if state.Summary != "" {
		t.Fatalf("expected summary to stay empty on failure, got %q", state.Summary)
	}
	if len(state.RecentMessages) != 3 {
		t.Fatalf("expected recent messages to remain intact, got %d", len(state.RecentMessages))
	}
	if len(msgs) != 4 {
		t.Fatalf("expected system + 3 recent messages, got %d", len(msgs))
	}
}

func TestAppendHistoryKeepsFallbackWindowWhenCompactorDisabled(t *testing.T) {
	brain := newTestBrain(nil, ContextCompactionConfig{Enabled: false})
	sessionID := "user_3"

	var messages []*schema.Message
	for i := 0; i < 25; i++ {
		messages = append(messages, &schema.Message{
			Role:    schema.Assistant,
			Content: "message",
		})
	}

	brain.appendHistory(sessionID, messages...)

	state := brain.history[sessionID]
	if state == nil {
		t.Fatalf("expected session state to exist")
	}
	if got := len(state.RecentMessages); got != fallbackRecentHistoryLimit {
		t.Fatalf("expected fallback history window %d, got %d", fallbackRecentHistoryLimit, got)
	}
}
