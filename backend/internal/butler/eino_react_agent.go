package butler

import (
	"context"
	"fmt"
	"io"
	"log"

	"github.com/cloudwego/eino-ext/components/model/openai"
	"github.com/cloudwego/eino/components/tool"
	"github.com/cloudwego/eino/flow/agent/react"
	"github.com/cloudwego/eino/schema"
)

// reactAgentOrchestrator wraps ReAct Agent for Butler reasoning with tool support
type reactAgentOrchestrator struct {
	agent *react.Agent
	tools []tool.BaseTool
}

// newReActAgentOrchestrator creates an ADK-based orchestrator with ReAct pattern
func newReActAgentOrchestrator(chatModel *openai.ChatModel) assistantOrchestrator {
	if chatModel == nil {
		return nil
	}

	// Register Butler tools
	tools := []tool.BaseTool{
		NewCommandAgentTool(),
	}

	// Create ReAct Agent
	reactAgent, err := react.NewAgent(context.Background(), &react.AgentConfig{
		Model: chatModel,
		MessageModifier: func(ctx context.Context, msgs []*schema.Message) []*schema.Message {
			// System prompt is already in msgs[0], just pass through
			return msgs
		},
		MaxStep: 15,
	})
	if err != nil {
		log.Printf("[ReAct Agent] Failed to create agent: %v", err)
		return nil
	}

	log.Printf("[ReAct Agent] Initialized with %d tools", len(tools))
	return &reactAgentOrchestrator{
		agent: reactAgent,
		tools: tools,
	}
}

// GenerateAssistant performs non-streaming generation (for simple cases)
func (o *reactAgentOrchestrator) GenerateAssistant(ctx context.Context, msgs []*schema.Message) (*schema.Message, error) {
	// Use react.Agent's Generate method directly
	toolOpts, _ := react.WithTools(ctx, o.tools...)

	msg, err := o.agent.Generate(ctx, msgs, toolOpts...)
	if err != nil {
		return nil, fmt.Errorf("ReAct agent generate failed: %w", err)
	}
	return msg, nil
}

// StreamAssistantForDecision streams agent reasoning with tool execution
func (o *reactAgentOrchestrator) StreamAssistantForDecision(ctx context.Context, msgs []*schema.Message, onChunk func(string) error) (*streamDecision, error) {
	// Use react.Agent's Stream method
	toolOpts, _ := react.WithTools(ctx, o.tools...)

	streamReader, err := o.agent.Stream(ctx, msgs, toolOpts...)
	if err != nil {
		return nil, fmt.Errorf("ReAct agent stream failed: %w", err)
	}
	defer streamReader.Close()

	var fullContent string

	// Read stream chunks
	for {
		chunk, recvErr := streamReader.Recv()
		if recvErr == io.EOF {
			break
		}
		if recvErr != nil {
			log.Printf("[ReAct Agent] Stream recv error: %v", recvErr)
			break
		}
		if chunk == nil || chunk.Content == "" {
			continue
		}

		// Emit chunk to user
		fullContent += chunk.Content
		_ = onChunk(chunk.Content)
	}

	// ADK handles tool execution automatically, no need to detect COMMAND_AGENT text
	return &streamDecision{
		Content:     fullContent,
		CommandText: "", // No longer needed with ADK
	}, nil
}

// StreamAssistantSummary streams a summary generation (used after command execution)
func (o *reactAgentOrchestrator) StreamAssistantSummary(ctx context.Context, msgs []*schema.Message) (string, error) {
	// For summary, use Generate without tools to avoid unnecessary tool calls
	msg, err := o.agent.Generate(ctx, msgs)
	if err != nil {
		return "", fmt.Errorf("ReAct agent summary failed: %w", err)
	}

	return msg.Content, nil
}
