package butler

import (
	"context"
	"log"
	"time"

	"github.com/cloudwego/eino/schema"
	"github.com/lea/echocenter/backend/internal/observability"
)

const fallbackRecentHistoryLimit = 20

type conversationState struct {
	Summary         string
	RecentMessages  []*schema.Message
	LastCompactedAt time.Time
}

func (b *EinoBrain) prepareConversation(ctx context.Context, sessionID, input, systemState string) []*schema.Message {
	b.historyMu.Lock()
	defer b.historyMu.Unlock()

	state := b.getOrCreateConversationState(sessionID)
	state.RecentMessages = append(state.RecentMessages, schema.UserMessage(input))

	if err := b.compactHistoryIfNeededLocked(ctx, state); err != nil {
		log.Printf("[Butler] Context compaction failed for session %s: %v", sessionID, err)
	}

	return buildConversationMessages(buildButlerSystemPrompt(systemState), state)
}

func (b *EinoBrain) appendHistory(sessionID string, messages ...*schema.Message) {
	if len(messages) == 0 {
		return
	}

	b.historyMu.Lock()
	defer b.historyMu.Unlock()

	state := b.getOrCreateConversationState(sessionID)
	state.RecentMessages = append(state.RecentMessages, cloneMessages(messages)...)
	if !b.hasContextCompactor() {
		state.RecentMessages = trimRecentMessages(state.RecentMessages, fallbackRecentHistoryLimit)
	}
}

func (b *EinoBrain) getOrCreateConversationState(sessionID string) *conversationState {
	if b.history[sessionID] == nil {
		b.history[sessionID] = &conversationState{}
	}
	return b.history[sessionID]
}

func (b *EinoBrain) compactHistoryIfNeededLocked(ctx context.Context, state *conversationState) error {
	if !b.hasContextCompactor() || !b.shouldCompactLocked(state) {
		return nil
	}

	preCompactChars := estimateConversationChars(state)
	preCompactMessages := len(state.RecentMessages)
	messagesToCompact, recentWindow := splitMessagesForCompaction(state.RecentMessages, b.compaction.RecentWindow)
	if len(messagesToCompact) == 0 {
		return nil
	}

	spanCtx, span := observability.StartSpan(ctx, "butler.context_compaction", "custom")
	defer span.Finish(spanCtx)
	span.SetTags(spanCtx, map[string]any{
		"messages_before": preCompactMessages,
		"chars_before":    preCompactChars,
		"recent_window":   b.compaction.RecentWindow,
	})
	span.SetInput(spanCtx, map[string]any{
		"existing_summary_length": len(state.Summary),
		"messages_to_compact":     len(messagesToCompact),
		"recent_window":           b.compaction.RecentWindow,
	})

	summary, err := b.compactor.Compact(ctx, contextCompactionRequest{
		ExistingSummary: state.Summary,
		Messages:        cloneMessages(messagesToCompact),
	})
	if err != nil {
		span.SetStatusCode(spanCtx, 1)
		span.SetError(spanCtx, err)
		return err
	}

	state.Summary = summary
	state.RecentMessages = recentWindow
	state.LastCompactedAt = time.Now()
	span.SetOutput(spanCtx, map[string]any{
		"summary_length": len(summary),
		"messages_after": len(state.RecentMessages),
		"chars_after":    estimateConversationChars(state),
		"compacted_at":   state.LastCompactedAt.Format(time.RFC3339Nano),
	})
	return nil
}

func (b *EinoBrain) hasContextCompactor() bool {
	return b != nil && b.compaction.Enabled && b.compactor != nil
}

func (b *EinoBrain) shouldCompactLocked(state *conversationState) bool {
	if state == nil {
		return false
	}

	if b.compaction.TriggerMessages > 0 && len(state.RecentMessages) > b.compaction.TriggerMessages {
		return true
	}

	if b.compaction.TriggerChars > 0 && estimateConversationChars(state) > b.compaction.TriggerChars {
		return true
	}

	return false
}

func buildConversationMessages(systemPrompt string, state *conversationState) []*schema.Message {
	msgs := []*schema.Message{schema.SystemMessage(systemPrompt)}
	if state != nil && state.Summary != "" {
		msgs = append(msgs, schema.SystemMessage(buildConversationSummaryPrompt(state.Summary)))
	}
	if state != nil {
		msgs = append(msgs, cloneMessages(state.RecentMessages)...)
	}
	return msgs
}

func buildConversationSummaryPrompt(summary string) string {
	return "Conversation summary so far:\n" + summary
}

func estimateConversationChars(state *conversationState) int {
	if state == nil {
		return 0
	}

	total := len(state.Summary)
	for _, msg := range state.RecentMessages {
		if msg == nil {
			continue
		}
		total += len(msg.Content)
	}
	return total
}

func splitMessagesForCompaction(messages []*schema.Message, recentWindow int) ([]*schema.Message, []*schema.Message) {
	if recentWindow < 1 {
		recentWindow = 1
	}
	if len(messages) <= recentWindow {
		return nil, cloneMessages(messages)
	}

	splitAt := len(messages) - recentWindow
	return cloneMessages(messages[:splitAt]), cloneMessages(messages[splitAt:])
}

func trimRecentMessages(messages []*schema.Message, limit int) []*schema.Message {
	if limit < 1 || len(messages) <= limit {
		return cloneMessages(messages)
	}
	return cloneMessages(messages[len(messages)-limit:])
}

func cloneMessages(messages []*schema.Message) []*schema.Message {
	if len(messages) == 0 {
		return nil
	}

	cloned := make([]*schema.Message, 0, len(messages))
	for _, msg := range messages {
		if msg == nil {
			continue
		}
		msgCopy := *msg
		cloned = append(cloned, &msgCopy)
	}
	return cloned
}
