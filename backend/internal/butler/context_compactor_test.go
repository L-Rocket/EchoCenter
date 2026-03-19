package butler

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/cloudwego/eino/schema"
)

type stubCompactor struct {
	summary string
	err     error
	calls   int
	lastReq contextCompactionRequest
	block   chan struct{}
}

func (s *stubCompactor) Compact(_ context.Context, req contextCompactionRequest) (string, error) {
	s.calls++
	s.lastReq = req
	if s.block != nil {
		<-s.block
	}
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

func TestPrepareConversationCompactsOlderMessagesAsynchronously(t *testing.T) {
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

	state := brain.history[sessionID]
	if state == nil {
		t.Fatalf("expected session state to exist")
	}
	if state.Summary != "" {
		t.Fatalf("expected summary to stay empty during triggering turn, got %q", state.Summary)
	}
	if state.PendingCompaction == nil {
		t.Fatalf("expected async compaction to be scheduled")
	}

	if !waitForCondition(500*time.Millisecond, func() bool { return compactor.calls == 1 }) {
		t.Fatalf("expected compactor to run once asynchronously, got %d", compactor.calls)
	}
	if msgs[0].Role != schema.System || !strings.Contains(msgs[0].Content, "CURRENT SYSTEM STATE") {
		t.Fatalf("expected first message to be runtime system prompt")
	}
	if len(msgs) != 4 {
		t.Fatalf("expected triggering turn to use uncompressed context, got %d messages", len(msgs))
	}
	if len(compactor.lastReq.Messages) != 2 {
		t.Fatalf("expected 2 messages to compact, got %d", len(compactor.lastReq.Messages))
	}

	if !waitForCondition(500*time.Millisecond, func() bool {
		state := brain.history[sessionID]
		return state != nil && state.PendingCompaction == nil && state.Summary == compactor.summary
	}) {
		t.Fatalf("expected async compaction result to be applied")
	}

	state = brain.history[sessionID]
	if len(state.RecentMessages) != 1 || state.RecentMessages[0].Content != "second request" {
		t.Fatalf("expected only latest message to remain recent after apply, got %#v", state.RecentMessages)
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

	if !waitForCondition(500*time.Millisecond, func() bool { return compactor.calls == 1 }) {
		t.Fatalf("expected async compactor attempt, got %d", compactor.calls)
	}

	if len(msgs) != 4 {
		t.Fatalf("expected triggering turn to keep full recent messages, got %d", len(msgs))
	}

	if !waitForCondition(500*time.Millisecond, func() bool {
		state := brain.history[sessionID]
		return state != nil && state.PendingCompaction == nil
	}) {
		t.Fatalf("expected pending compaction to clear after failure")
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

func waitForCondition(timeout time.Duration, cond func() bool) bool {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		if cond() {
			return true
		}
		time.Sleep(10 * time.Millisecond)
	}
	return cond()
}
