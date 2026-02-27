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

// EinoBrain represents the Butler's reasoning engine
type EinoBrain struct {
	logChain  compose.Runnable[models.Message, string]
	chatModel *openai.ChatModel
	
	// Simple in-memory history management
	historyMu sync.RWMutex
	history   map[string][]*schema.Message
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

	return &EinoBrain{
		logChain:  lChain,
		chatModel: chatModel,
		history:   make(map[string][]*schema.Message),
	}
}

func (b *EinoBrain) ObserveLog(ctx context.Context, msg models.Message) (string, error) {
	return b.logChain.Invoke(ctx, msg)
}

func (b *EinoBrain) Chat(ctx context.Context, sessionID string, input string) (string, error) {
	if b.chatModel == nil {
		return "I am currently operating in safe-mode. My intelligence core is offline, but I can still assist with basic system monitoring.", nil
	}

	b.historyMu.Lock()
	msgs := b.history[sessionID]
	if len(msgs) == 0 {
		msgs = append(msgs, schema.SystemMessage("You are the EchoCenter Butler, an intelligent manager of an AI Agent hive. Be professional, concise, and helpful. You have oversight of all system logs."))
	}
	
	// Add user message to history
	userMsg := schema.UserMessage(input)
	msgs = append(msgs, userMsg)
	b.history[sessionID] = msgs
	b.historyMu.Unlock()

	// Invoke model with full history
	resp, err := b.chatModel.Generate(ctx, msgs)
	if err != nil {
		return "", err
	}

	// Add assistant response to history
	b.historyMu.Lock()
	b.history[sessionID] = append(b.history[sessionID], resp)
	
	// Keep history manageable
	b.trimHistory(sessionID)
	b.historyMu.Unlock()

	return resp.Content, nil
}

func (b *EinoBrain) ChatStream(ctx context.Context, sessionID string, input string, onChunk func(chunk string) error) (string, error) {
	if b.chatModel == nil {
		reply := "I am currently operating in safe-mode. My intelligence core is offline, but I can still assist with basic system monitoring."
		for _, word := range []string{"I ", "am ", "currently ", "operating ", "in ", "safe-mode."} {
			_ = onChunk(word)
		}
		return reply, nil
	}

	b.historyMu.Lock()
	msgs := b.history[sessionID]
	if len(msgs) == 0 {
		msgs = append(msgs, schema.SystemMessage("You are the EchoCenter Butler, an intelligent manager of an AI Agent hive. Be professional, concise, and helpful. You have oversight of all system logs."))
	}
	userMsg := schema.UserMessage(input)
	msgs = append(msgs, userMsg)
	b.history[sessionID] = msgs
	b.historyMu.Unlock()

	// Invoke streaming
	stream, err := b.chatModel.Stream(ctx, msgs)
	if err != nil {
		return "", err
	}
	defer stream.Close()

	fullContent := ""
	for {
		chunk, err := stream.Recv()
		if err != nil {
			// EOF or error
			break
		}
		content := chunk.Content
		fullContent += content
		if err := onChunk(content); err != nil {
			return fullContent, err
		}
	}

	// Add assistant response to history
	b.historyMu.Lock()
	assistantMsg := schema.AssistantMessage(fullContent, nil)
	b.history[sessionID] = append(b.history[sessionID], assistantMsg)
	b.trimHistory(sessionID)
	b.historyMu.Unlock()

	return fullContent, nil
}

func (b *EinoBrain) trimHistory(sessionID string) {
	if len(b.history[sessionID]) > 21 {
		newHistory := []*schema.Message{b.history[sessionID][0]}
		newHistory = append(newHistory, b.history[sessionID][len(b.history[sessionID])-20:]...)
		b.history[sessionID] = newHistory
	}
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

	return &EinoBrain{
		logChain: lChain,
		history:  make(map[string][]*schema.Message),
	}
}
