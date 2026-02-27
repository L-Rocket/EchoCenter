package butler

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"regexp"
	"sync"

	"github.com/cloudwego/eino-ext/components/model/openai"
	"github.com/cloudwego/eino/compose"
	"github.com/cloudwego/eino/schema"
	"github.com/lea/echocenter/backend/internal/models"
)

var (
	// Regex to find tool calls like: COMMAND_AGENT: {"target_agent_id": 7, "command": "status", "reasoning": "checking"}
	commandRegex = regexp.MustCompile(`COMMAND_AGENT:\s*({.*})`)
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

	chatModel, err := openai.NewChatModel(context.Background(), &openai.ChatModelConfig{
		BaseURL: baseURL,
		Model:   model,
		APIKey:  apiToken,
	})
	if err != nil {
		log.Printf("ERROR: Failed to initialize Eino ChatModel: %v", err)
		return newMockBrain()
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
		logChain:  lChain,
		chatModel: chatModel,
		history:   make(map[string][]*schema.Message),
	}
}

func (b *EinoBrain) ObserveLog(ctx context.Context, msg models.Message) (string, error) {
	if b.logChain == nil {
		return "Log ignored (no brain).", nil
	}
	return b.logChain.Invoke(ctx, msg)
}

func (b *EinoBrain) Chat(ctx context.Context, sessionID string, input string, systemState string) (string, error) {
	if b.chatModel == nil {
		return "Safe-mode active.", nil
	}

	b.historyMu.Lock()
	msgs := b.history[sessionID]
	
	systemPrompt := `You are the EchoCenter Butler, the commander of an AI Agent hive.
If you need to ask another agent a question or give it a command, you MUST output a special line:
COMMAND_AGENT: {"target_agent_id": ID, "command": "instruction", "reasoning": "why"}

RULES:
1. NEVER say "I cannot check status". Instead, use the COMMAND_AGENT format above.
2. After receiving a tool result (labeled as SYSTEM: Tool result was...), SIMPLY SUMMARIZE the result for the user.
3. DO NOT initiate a new COMMAND_AGENT call immediately after receiving a tool result. Wait for the user's next instruction.
4. Be professional.`

	if systemState != "" {
		systemPrompt += "\n\nCURRENT SYSTEM STATE:\n" + systemState
	}

	if len(msgs) == 0 {
		msgs = append(msgs, schema.SystemMessage(systemPrompt))
	} else if msgs[0].Role == schema.System {
		msgs[0].Content = systemPrompt
	}
	
	msgs = append(msgs, schema.UserMessage(input))
	b.history[sessionID] = msgs
	b.historyMu.Unlock()

	// 1. Get LLM response
	resp, err := b.chatModel.Generate(ctx, msgs)
	if err != nil {
		return "", err
	}

	content := resp.Content
	
	// 2. Intercept manual tool calls
	match := commandRegex.FindStringSubmatch(content)
	if len(match) > 1 {
		jsonParams := match[1]
		// Validate JSON to avoid crash
		var tmp map[string]interface{}
		if err := json.Unmarshal([]byte(jsonParams), &tmp); err != nil {
			log.Printf("[Butler Brain] Invalid command JSON: %v", err)
			return content, nil
		}
		
		log.Printf("[Butler Brain] Intercepted manual command: %s", jsonParams)
		
		// Execute Go tool logic
		tool := NewCommandAgentTool()
		result, err := tool.InvokableRun(ctx, jsonParams)
		if err != nil {
			result = fmt.Sprintf("Tool error: %v", err)
		}

		// Inject result back into history
		b.historyMu.Lock()
		b.history[sessionID] = append(b.history[sessionID], resp)
		b.history[sessionID] = append(b.history[sessionID], schema.UserMessage("SYSTEM: Tool result was: "+result))
		
		// Get final summary
		finalResp, _ := b.chatModel.Generate(ctx, b.history[sessionID])
		content = finalResp.Content
		
		// SAFETY: Remove any accidental new command lines from the summary to prevent loops
		content = commandRegex.ReplaceAllString(content, "")
		
		b.history[sessionID] = append(b.history[sessionID], finalResp)
		b.trimHistory(sessionID)
		b.historyMu.Unlock()
	} else {
		b.historyMu.Lock()
		b.history[sessionID] = append(b.history[sessionID], resp)
		b.historyMu.Unlock()
	}

	return content, nil
}

func (b *EinoBrain) ChatStream(ctx context.Context, sessionID string, input string, systemState string, onChunk func(chunk string) error) (string, error) {
	// Call Chat internally but trigger intermediate feedback via onChunk
	// This gives the "Gemini CLI" style execution feedback
	
	// Pre-reasoning feedback
	_ = onChunk("Butler is analyzing request...")

	reply, err := b.Chat(ctx, sessionID, input, systemState)
	if err != nil {
		return "", err
	}

	// We don't want to double-print if Chat already handled some output
	// But since Chat is blocking and intercepts, we can provide the final summary here
	if reply != "" {
		_ = onChunk("\n\n" + reply)
	}
	
	return reply, nil
}

func (b *EinoBrain) trimHistory(sessionID string) {
	if len(b.history[sessionID]) > 21 {
		newHistory := []*schema.Message{b.history[sessionID][0]}
		newHistory = append(newHistory, b.history[sessionID][len(b.history[sessionID])-20:]...)
		b.history[sessionID] = newHistory
	}
}

func newMockBrain() *EinoBrain {
	logBuilder := compose.NewChain[models.Message, string]()
	logBuilder.AppendLambda(compose.InvokableLambda(func(ctx context.Context, msg models.Message) (string, error) {
		return "Log noted. (Safe-mode)", nil
	}))
	lChain, _ := logBuilder.Compile(context.Background())
	return &EinoBrain{
		logChain: lChain,
		history:  make(map[string][]*schema.Message),
	}
}
