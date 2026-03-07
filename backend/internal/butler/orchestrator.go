package butler

import (
	"context"

	"github.com/cloudwego/eino/schema"
)

// streamDecision represents the result of streaming model inference with optional command detection.
// Note: Command detection is deprecated in ADK ReAct Agent mode.
type streamDecision struct {
	Content     string // The streamed content
	CommandText string // Deprecated: only used in fallback mode
}

// assistantOrchestrator defines the interface for LLM orchestration.
// This can be implemented by ReAct Agent or other orchestration strategies.
type assistantOrchestrator interface {
	GenerateAssistant(ctx context.Context, msgs []*schema.Message) (*schema.Message, error)
	StreamAssistantForDecision(ctx context.Context, msgs []*schema.Message, onChunk func(string) error) (*streamDecision, error)
	StreamAssistantSummary(ctx context.Context, msgs []*schema.Message) (string, error)
}
