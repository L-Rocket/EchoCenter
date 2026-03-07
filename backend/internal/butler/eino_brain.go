package butler

import (
	"context"
	"fmt"
	"log"
	"sync"

	"github.com/cloudwego/eino-ext/components/model/openai"
	"github.com/cloudwego/eino/compose"
	"github.com/cloudwego/eino/schema"
	"github.com/lea/echocenter/backend/internal/models"
)

// EinoBrain represents the Butler's reasoning engine.
type EinoBrain struct {
	logChain compose.Runnable[models.Message, string]
	orch     assistantOrchestrator

	// Simple in-memory history management.
	historyMu sync.RWMutex
	history   map[string][]*schema.Message
}

func NewEinoBrain(baseURL, apiToken, model string) *EinoBrain {
	if baseURL == "" {
		return newMockBrain()
	}

	chatModel, err := openai.NewChatModel(context.Background(), &openai.ChatModelConfig{
		BaseURL: baseURL,
		Model:   model,
		APIKey:  apiToken,
	})
	if err != nil {
		log.Printf("ERROR: Failed to initialize Eino ChatModel: %v", err)
		return newMockBrain()
	}

	// Use ReAct Agent for tool-enabled reasoning
	orchestratorImpl := newReActAgentOrchestrator(chatModel)
	if orchestratorImpl == nil {
		log.Printf("ERROR: ReAct Agent initialization failed, brain will run in safe mode")
		// Return a butler with nil orchestrator (will use safeModeReply)
		return &EinoBrain{
			logChain: nil,
			orch:     nil,
			history:  make(map[string][]*schema.Message),
		}
	}

	logBuilder := compose.NewChain[models.Message, string]()
	logBuilder.AppendLambda(compose.InvokableLambda(func(ctx context.Context, msg models.Message) ([]*schema.Message, error) {
		prompt := fmt.Sprintf(`You are the EchoCenter Butler.
An agent named "%s" just reported a "%s" level event:
"%s"
Provide a very brief thought.`, msg.AgentID, msg.Level, msg.Content)
		return []*schema.Message{schema.SystemMessage("System coordinator."), schema.UserMessage(prompt)}, nil
	}))
	logBuilder.AppendChatModel(chatModel)
	logBuilder.AppendLambda(compose.InvokableLambda(func(ctx context.Context, resp *schema.Message) (string, error) {
		return resp.Content, nil
	}))
	lChain, _ := logBuilder.Compile(context.Background())

	return &EinoBrain{
		logChain: lChain,
		orch:     orchestratorImpl,
		history:  make(map[string][]*schema.Message),
	}
}

func (b *EinoBrain) ObserveLog(ctx context.Context, msg models.Message) (string, error) {
	if b.logChain == nil {
		return "Log ignored (no brain).", nil
	}
	return b.logChain.Invoke(ctx, msg)
}

func newMockBrain() *EinoBrain {
	logBuilder := compose.NewChain[models.Message, string]()
	logBuilder.AppendLambda(compose.InvokableLambda(func(ctx context.Context, msg models.Message) (string, error) {
		if msg.Level == "ERROR" {
			return "I should probably check this error. (Safe-mode)", nil
		}
		return "Log noted. (Safe-mode)", nil
	}))
	lChain, _ := logBuilder.Compile(context.Background())

	return &EinoBrain{
		logChain: lChain,
		history:  make(map[string][]*schema.Message),
	}
}
