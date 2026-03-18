package butler

import (
	"context"
	"fmt"
	"log"
	"strings"

	"github.com/cloudwego/eino-ext/components/model/openai"
	"github.com/cloudwego/eino/compose"
	"github.com/cloudwego/eino/schema"
)

const (
	defaultCompactionTriggerMessages = 24
	defaultCompactionTriggerChars    = 12000
	defaultCompactionRecentWindow    = 8
)

type ContextCompactionConfig struct {
	Enabled         bool
	BaseURL         string
	APIToken        string
	Model           string
	TriggerMessages int
	TriggerChars    int
	RecentWindow    int
}

type contextCompactionRequest struct {
	ExistingSummary string
	Messages        []*schema.Message
}

type contextCompactor interface {
	Compact(ctx context.Context, req contextCompactionRequest) (string, error)
}

type llmContextCompactor struct {
	chain compose.Runnable[contextCompactionRequest, string]
}

func newContextCompactionConfig(baseURL, apiToken, model string) ContextCompactionConfig {
	return ContextCompactionConfig{
		Enabled:         true,
		BaseURL:         baseURL,
		APIToken:        apiToken,
		Model:           model,
		TriggerMessages: defaultCompactionTriggerMessages,
		TriggerChars:    defaultCompactionTriggerChars,
		RecentWindow:    defaultCompactionRecentWindow,
	}
}

func (c ContextCompactionConfig) withDefaults() ContextCompactionConfig {
	cfg := c
	if cfg.TriggerMessages <= 0 {
		cfg.TriggerMessages = defaultCompactionTriggerMessages
	}
	if cfg.TriggerChars <= 0 {
		cfg.TriggerChars = defaultCompactionTriggerChars
	}
	if cfg.RecentWindow <= 0 {
		cfg.RecentWindow = defaultCompactionRecentWindow
	}
	return cfg
}

func newContextCompactor(baseURL, apiToken, model string, cfg ContextCompactionConfig) contextCompactor {
	cfg = cfg.withDefaults()
	if !cfg.Enabled || baseURL == "" {
		return nil
	}

	chatModel, err := openai.NewChatModel(context.Background(), &openai.ChatModelConfig{
		BaseURL: baseURL,
		Model:   model,
		APIKey:  apiToken,
	})
	if err != nil {
		log.Printf("[Butler] Failed to initialize context compactor model: %v", err)
		return nil
	}

	builder := compose.NewChain[contextCompactionRequest, string]()
	builder.AppendLambda(compose.InvokableLambda(func(ctx context.Context, req contextCompactionRequest) ([]*schema.Message, error) {
		return []*schema.Message{
			schema.SystemMessage(compactorSystemPrompt),
			schema.UserMessage(buildCompactionPrompt(req)),
		}, nil
	}))
	builder.AppendChatModel(chatModel)
	builder.AppendLambda(compose.InvokableLambda(func(ctx context.Context, resp *schema.Message) (string, error) {
		return strings.TrimSpace(resp.Content), nil
	}))

	chain, err := builder.Compile(context.Background())
	if err != nil {
		log.Printf("[Butler] Failed to compile context compactor chain: %v", err)
		return nil
	}

	return &llmContextCompactor{chain: chain}
}

func (c *llmContextCompactor) Compact(ctx context.Context, req contextCompactionRequest) (string, error) {
	if c == nil || c.chain == nil {
		return "", fmt.Errorf("context compactor unavailable")
	}

	summary, err := c.chain.Invoke(ctx, req)
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(summary), nil
}

func buildCompactionPrompt(req contextCompactionRequest) string {
	var builder strings.Builder
	if req.ExistingSummary != "" {
		builder.WriteString("Existing summary:\n")
		builder.WriteString(req.ExistingSummary)
		builder.WriteString("\n\n")
	}

	builder.WriteString("Messages to compress:\n")
	for _, msg := range req.Messages {
		if msg == nil || msg.Content == "" {
			continue
		}
		builder.WriteString("- ")
		builder.WriteString(string(msg.Role))
		builder.WriteString(": ")
		builder.WriteString(msg.Content)
		builder.WriteString("\n")
	}

	builder.WriteString("\nReturn a compact summary with these sections:\n")
	builder.WriteString("1. Active user goals\n")
	builder.WriteString("2. Important facts and constraints\n")
	builder.WriteString("3. Completed work and outcomes\n")
	builder.WriteString("4. Open questions or pending follow-ups\n")
	builder.WriteString("5. Recent agent/tool results that still matter\n")
	return builder.String()
}

const compactorSystemPrompt = `You are a runtime-only context compaction agent for EchoCenter Butler.

Your job is to compress older conversation history into a durable working summary.

Rules:
1. Keep concrete facts, user intent, constraints, and unresolved items.
2. Preserve outcomes from tool calls or agent coordination when they still matter.
3. Omit filler, politeness, and repeated phrasing.
4. Write concise bullet-style prose that another model can continue from.
5. Never invent facts that were not present in the input.`
