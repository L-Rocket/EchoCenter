package butler

import (
	"context"
	"fmt"
	"log"

	"github.com/cloudwego/eino-ext/components/model/openai"
	"github.com/cloudwego/eino/compose"
	"github.com/cloudwego/eino/schema"
	"github.com/lea/echocenter/backend/internal/models"
)

// EinoBrain represents the Butler's reasoning engine
type EinoBrain struct {
	logChain  compose.Runnable[models.Message, string]
	chatChain compose.Runnable[string, string]
}

func NewEinoBrain(baseURL, apiToken, model string) *EinoBrain {
	if baseURL == "" {
		return newMockBrain()
	}

	// 1. Initialize the ChatModel
	chatModel, err := openai.NewChatModel(context.Background(), &openai.ChatModelConfig{
		BaseURL: baseURL,
		Model:   model,
		APIKey:  apiToken,
	})
	if err != nil {
		log.Printf("ERROR: Failed to initialize Eino ChatModel: %v. Butler will use mock logic.", err)
		return newMockBrain()
	}

	// --- Log Observation Chain ---
	logBuilder := compose.NewChain[models.Message, string]()
	logBuilder.AppendLambda(compose.InvokableLambda(func(ctx context.Context, msg models.Message) ([]*schema.Message, error) {
		prompt := fmt.Sprintf(`You are the EchoCenter Butler. 
An agent named "%s" just reported a "%s" level event:
"%s"
Provide a very brief (one sentence) internal thought about this.`, msg.AgentID, msg.Level, msg.Content)
		return []*schema.Message{schema.SystemMessage("You are a professional system coordinator."), schema.UserMessage(prompt)}, nil
	}))
	logBuilder.AppendChatModel(chatModel)
	logBuilder.AppendLambda(compose.InvokableLambda(func(ctx context.Context, resp *schema.Message) (string, error) {
		return resp.Content, nil
	}))
	lChain, _ := logBuilder.Compile(context.Background())

	// --- Direct Chat Chain ---
	chatBuilder := compose.NewChain[string, string]()
	chatBuilder.AppendLambda(compose.InvokableLambda(func(ctx context.Context, input string) ([]*schema.Message, error) {
		return []*schema.Message{
			schema.SystemMessage("You are the EchoCenter Butler, an intelligent manager of an AI Agent hive. Be professional, concise, and helpful. You have oversight of all system logs."),
			schema.UserMessage(input),
		}, nil
	}))
	chatBuilder.AppendChatModel(chatModel)
	chatBuilder.AppendLambda(compose.InvokableLambda(func(ctx context.Context, resp *schema.Message) (string, error) {
		return resp.Content, nil
	}))
	cChain, _ := chatBuilder.Compile(context.Background())

	return &EinoBrain{
		logChain:  lChain,
		chatChain: cChain,
	}
}

func (b *EinoBrain) ObserveLog(ctx context.Context, msg models.Message) (string, error) {
	return b.logChain.Invoke(ctx, msg)
}

func (b *EinoBrain) Chat(ctx context.Context, input string) (string, error) {
	return b.chatChain.Invoke(ctx, input)
}

// Fallback mock brain if model init fails
func newMockBrain() *EinoBrain {
	logBuilder := compose.NewChain[models.Message, string]()
	logBuilder.AppendLambda(compose.InvokableLambda(func(ctx context.Context, msg models.Message) (string, error) {
		if msg.Level == "ERROR" {
			return "I should probably check this error. (Safe-mode)", nil
		}
		return "Log noted. (Safe-mode)", nil
	}))
	lChain, _ := logBuilder.Compile(context.Background())

	chatBuilder := compose.NewChain[string, string]()
	chatBuilder.AppendLambda(compose.InvokableLambda(func(ctx context.Context, input string) (string, error) {
		return "I am currently operating in safe-mode. My intelligence core is offline, but I can still assist with basic system monitoring.", nil
	}))
	cChain, _ := chatBuilder.Compile(context.Background())

	return &EinoBrain{logChain: lChain, chatChain: cChain}
}
