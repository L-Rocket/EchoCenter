package butler

import (
	"context"
	"time"

	"github.com/cloudwego/eino/schema"
)

// ChatStreamResult represents the result of a chat stream.
// Note: With ADK ReAct Agent, tool execution is automatic. HasCommand and Command
// are deprecated and always return false/nil values.
type ChatStreamResult struct {
	Content    string         // The natural language content streamed to user.
	Command    map[string]any // Deprecated: always nil with ReAct Agent.
	HasCommand bool           // Deprecated: always false with ReAct Agent.
	SessionID  string         // Session ID for continuation.
	CreatedAt  time.Time      // When this result was created.
}

// ChatStream streams the response using ReAct Agent (with automatic tool execution).
func (b *EinoBrain) ChatStream(ctx context.Context, sessionID, input, systemState string, onChunk func(chunk string) error) (*ChatStreamResult, error) {
	if b.orch == nil {
		_ = onChunk(safeModeReply)
		return &ChatStreamResult{
			Content:    safeModeReply,
			HasCommand: false,
			SessionID:  sessionID,
			CreatedAt:  time.Now(),
		}, nil
	}

	msgs := b.prepareConversation(sessionID, input, systemState)

	decision, err := b.orch.StreamAssistantForDecision(ctx, msgs, onChunk)
	if err != nil {
		partial := ""
		if decision != nil {
			partial = decision.Content
		}
		return &ChatStreamResult{
			Content:    partial,
			HasCommand: false,
			SessionID:  sessionID,
			CreatedAt:  time.Now(),
		}, err
	}

	content := decision.Content
	b.appendHistory(sessionID, &schema.Message{Role: schema.Assistant, Content: content})

	// ReAct Agent handles tool execution automatically, no need for command detection
	return &ChatStreamResult{
		Content:    content,
		HasCommand: false,
		SessionID:  sessionID,
		CreatedAt:  time.Now(),
	}, nil
}
