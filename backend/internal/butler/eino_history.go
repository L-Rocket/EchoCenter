package butler

import (
	"context"
	"log"
	"strings"
	"time"

	"github.com/cloudwego/eino/schema"
	"github.com/lea/echocenter/backend/internal/observability"
)

const fallbackRecentHistoryLimit = 20

type conversationState struct {
	Summary         string
	RecentMessages  []*schema.Message
	LastCompactedAt time.Time
	PendingCompaction *pendingCompactionState
}

type pendingCompactionState struct {
	JobID             uint64
	CompactedMessages []*schema.Message
}

type asyncCompactionJob struct {
	SessionID         string
	JobID             uint64
	PreCompactChars   int
	PreCompactMessages int
	Request           contextCompactionRequest
	CompactedMessages []*schema.Message
}

type PromptTrace struct {
	TotalMessages      int                  `json:"total_messages"`
	TotalChars         int                  `json:"total_chars"`
	SystemPromptChars  int                  `json:"system_prompt_chars"`
	MemorySummaryChars int                  `json:"memory_summary_chars"`
	RecentMessages     int                  `json:"recent_messages"`
	SummaryInjected    bool                 `json:"summary_injected"`
	Messages           []PromptMessageTrace `json:"messages"`
}

type PromptMessageTrace struct {
	Role    string `json:"role"`
	Chars   int    `json:"chars"`
	Preview string `json:"preview"`
}

func (b *EinoBrain) prepareConversation(ctx context.Context, sessionID, input, systemState string) []*schema.Message {
	b.historyMu.Lock()
	state := b.getOrCreateConversationState(sessionID)
	state.RecentMessages = append(state.RecentMessages, schema.UserMessage(input))
	job := b.startAsyncCompactionLocked(sessionID, state)
	msgs := buildConversationMessages(buildButlerSystemPrompt(systemState), state)
	b.historyMu.Unlock()

	if job != nil {
		go b.runAsyncCompaction(job)
	}

	return msgs
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

func (b *EinoBrain) startAsyncCompactionLocked(sessionID string, state *conversationState) *asyncCompactionJob {
	if !b.hasContextCompactor() || !b.shouldCompactLocked(state) || state == nil || state.PendingCompaction != nil {
		return nil
	}

	preCompactChars := estimateConversationChars(state)
	preCompactMessages := len(state.RecentMessages)
	messagesToCompact, _ := splitMessagesForCompaction(state.RecentMessages, b.compaction.RecentWindow)
	if len(messagesToCompact) == 0 {
		return nil
	}

	b.nextCompactionJob++
	jobID := b.nextCompactionJob
	compactedMessages := cloneMessages(messagesToCompact)
	state.PendingCompaction = &pendingCompactionState{
		JobID:             jobID,
		CompactedMessages: compactedMessages,
	}

	return &asyncCompactionJob{
		SessionID:          sessionID,
		JobID:              jobID,
		PreCompactChars:    preCompactChars,
		PreCompactMessages: preCompactMessages,
		Request: contextCompactionRequest{
			ExistingSummary: state.Summary,
			Messages:        compactedMessages,
		},
		CompactedMessages: compactedMessages,
	}
}

func (b *EinoBrain) runAsyncCompaction(job *asyncCompactionJob) {
	if b == nil || job == nil || b.compactor == nil {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	spanCtx, span := observability.StartSpan(ctx, "butler.context_compaction", "custom")
	defer span.Finish(spanCtx)
	span.SetThreadID(spanCtx, job.SessionID)
	span.SetTags(spanCtx, map[string]any{
		"messages_before": job.PreCompactMessages,
		"chars_before":    job.PreCompactChars,
		"recent_window":   b.compaction.RecentWindow,
		"async":           true,
	})
	span.SetInput(spanCtx, map[string]any{
		"existing_summary_length": len(job.Request.ExistingSummary),
		"messages_to_compact":     len(job.Request.Messages),
		"recent_window":           b.compaction.RecentWindow,
		"job_id":                  job.JobID,
	})

	summary, err := b.compactor.Compact(spanCtx, job.Request)
	if err != nil {
		span.SetStatusCode(spanCtx, 1)
		span.SetError(spanCtx, err)
		log.Printf("[Butler] Context compaction failed for session %s: %v", job.SessionID, err)
		b.clearPendingCompaction(job.SessionID, job.JobID)
		return
	}

	state, applied := b.applyCompletedCompaction(job.SessionID, job.JobID, job.CompactedMessages, summary)
	if !applied {
		log.Printf("[Butler] Dropped stale context compaction result for session %s", job.SessionID)
		return
	}

	span.SetOutput(spanCtx, map[string]any{
		"summary_length": len(summary),
		"messages_after": len(state.RecentMessages),
		"chars_after":    estimateConversationChars(state),
		"compacted_at":   state.LastCompactedAt.Format(time.RFC3339Nano),
	})
}

func (b *EinoBrain) clearPendingCompaction(sessionID string, jobID uint64) {
	b.historyMu.Lock()
	defer b.historyMu.Unlock()

	state := b.history[sessionID]
	if state == nil || state.PendingCompaction == nil || state.PendingCompaction.JobID != jobID {
		return
	}
	state.PendingCompaction = nil
}

func (b *EinoBrain) applyCompletedCompaction(sessionID string, jobID uint64, compactedMessages []*schema.Message, summary string) (*conversationState, bool) {
	b.historyMu.Lock()
	defer b.historyMu.Unlock()

	state := b.history[sessionID]
	if state == nil || state.PendingCompaction == nil || state.PendingCompaction.JobID != jobID {
		return nil, false
	}
	defer func() {
		state.PendingCompaction = nil
	}()

	if !hasMessagePrefix(state.RecentMessages, compactedMessages) {
		return nil, false
	}

	state.Summary = summary
	state.RecentMessages = cloneMessages(state.RecentMessages[len(compactedMessages):])
	state.LastCompactedAt = time.Now()
	return state, true
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

func hasMessagePrefix(messages, prefix []*schema.Message) bool {
	if len(prefix) == 0 {
		return true
	}
	if len(messages) < len(prefix) {
		return false
	}

	for idx, msg := range prefix {
		if msg == nil || messages[idx] == nil {
			return false
		}
		if messages[idx].Role != msg.Role || messages[idx].Content != msg.Content {
			return false
		}
	}
	return true
}

func summarizePreparedMessages(messages []*schema.Message) PromptTrace {
	trace := PromptTrace{
		TotalMessages: len(messages),
	}
	if len(messages) == 0 {
		return trace
	}

	for idx, msg := range messages {
		if msg == nil {
			continue
		}

		contentLen := len(msg.Content)
		trace.TotalChars += contentLen
		trace.Messages = append(trace.Messages, PromptMessageTrace{
			Role:    string(msg.Role),
			Chars:   contentLen,
			Preview: promptPreview(msg.Content),
		})

		switch {
		case idx == 0 && msg.Role == schema.System:
			trace.SystemPromptChars = contentLen
		case idx == 1 && msg.Role == schema.System && strings.HasPrefix(msg.Content, "Conversation summary so far:\n"):
			trace.MemorySummaryChars = contentLen
			trace.SummaryInjected = true
		default:
			trace.RecentMessages++
		}
	}

	return trace
}

func promptPreview(content string) string {
	normalized := strings.TrimSpace(strings.ReplaceAll(content, "\n", " "))
	if len(normalized) <= 160 {
		return normalized
	}
	return normalized[:160] + "..."
}
