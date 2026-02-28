package butler

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"regexp"
	"strings"
	"sync"
	"time"

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
		return "I am currently operating in safe-mode. My intelligence core is offline, but I can still assist with basic system monitoring.", nil
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

// ChatStreamResult represents the result of a chat stream
type ChatStreamResult struct {
	Content    string                 // The natural language content streamed to user
	Command    map[string]interface{} // The detected command (if any)
	HasCommand bool                   // Whether a command was detected
	SessionID  string                 // Session ID for continuation
	CreatedAt  time.Time              // When this result was created
}

// ChatStream streams the response and detects commands
// Returns when either: 1) Complete response without command, or 2) Command detected
func (b *EinoBrain) ChatStream(ctx context.Context, sessionID string, input string, systemState string, onChunk func(chunk string) error) (*ChatStreamResult, error) {
	if b.chatModel == nil {
		reply := "I am currently operating in safe-mode. My intelligence core is offline, but I can still assist with basic system monitoring."
		_ = onChunk(reply)
		return &ChatStreamResult{
			Content:    reply,
			HasCommand: false,
			SessionID:  sessionID,
			CreatedAt:  time.Now(),
		}, nil
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

	// Stream the response with command detection
	streamReader, err := b.chatModel.Stream(ctx, msgs)
	if err != nil {
		return nil, err
	}

	var fullReply strings.Builder
	var commandBuffer strings.Builder
	var checkBuffer strings.Builder
	inCommand := false
	defer streamReader.Close()

	for {
		chunk, err := streamReader.Recv()
		if err == io.EOF {
			break
		}
		if err != nil {
			return &ChatStreamResult{
				Content:    fullReply.String(),
				HasCommand: false,
				SessionID:  sessionID,
				CreatedAt:  time.Now(),
			}, err
		}
		if chunk != nil && chunk.Content != "" {
			if !inCommand {
				// Accumulate content to check for COMMAND_AGENT pattern
				checkBuffer.WriteString(chunk.Content)
				checkStr := checkBuffer.String()

				// Check if we have enough content to detect COMMAND_AGENT
				if strings.Contains(checkStr, "COMMAND_AGENT:") {
					log.Printf("[ChatStream] Detected COMMAND_AGENT in accumulated content")
					inCommand = true

					// Split at COMMAND_AGENT
					parts := strings.SplitN(checkStr, "COMMAND_AGENT:", 2)
					if len(parts) > 0 && parts[0] != "" {
						log.Printf("[ChatStream] Sending content before COMMAND_AGENT: %q", parts[0])
						fullReply.WriteString(parts[0])
						_ = onChunk(parts[0])
					}

					commandBuffer.WriteString("COMMAND_AGENT:")
					if len(parts) > 1 {
						commandBuffer.WriteString(parts[1])
						log.Printf("[ChatStream] Buffering command content: %q", parts[1])
					}
					checkBuffer.Reset()
					continue
				}

				// If buffer is getting too large without finding COMMAND_AGENT, flush it
				if checkBuffer.Len() > 100 {
					content := checkBuffer.String()
					fullReply.WriteString(content)
					_ = onChunk(content)
					checkBuffer.Reset()
				}
			} else {
				// In command mode, accumulate in command buffer
				commandBuffer.WriteString(chunk.Content)

				// Check if command is complete (has closing brace)
				cmdStr := commandBuffer.String()
				if strings.Count(cmdStr, "{") > 0 && strings.Count(cmdStr, "{") == strings.Count(cmdStr, "}") {
					log.Printf("[ChatStream] Command complete, stopping stream")
					break
				}
			}
		}
	}

	// Flush any remaining content in checkBuffer
	if !inCommand && checkBuffer.Len() > 0 {
		content := checkBuffer.String()
		fullReply.WriteString(content)
		_ = onChunk(content)
	}

	content := fullReply.String()

	// Check for command in the complete response
	cmdStr := commandBuffer.String()
	match := commandRegex.FindStringSubmatch(cmdStr)
	if len(match) > 1 {
		jsonParams := match[1]
		var cmdMap map[string]interface{}
		if err := json.Unmarshal([]byte(jsonParams), &cmdMap); err == nil {
			log.Printf("[Butler Brain] Detected command: %s", jsonParams)

			// Store the partial response in history (without executing)
			b.historyMu.Lock()
			b.history[sessionID] = append(b.history[sessionID], &schema.Message{Role: schema.Assistant, Content: content + cmdStr})
			b.historyMu.Unlock()

			return &ChatStreamResult{
				Content:    content,
				Command:    cmdMap,
				HasCommand: true,
				SessionID:  sessionID,
				CreatedAt:  time.Now(),
			}, nil
		}
	}

	// No command detected, store in history
	b.historyMu.Lock()
	b.history[sessionID] = append(b.history[sessionID], &schema.Message{Role: schema.Assistant, Content: content})
	b.historyMu.Unlock()

	return &ChatStreamResult{
		Content:    content,
		HasCommand: false,
		SessionID:  sessionID,
		CreatedAt:  time.Now(),
	}, nil
}

// ExecuteCommand executes a command and streams the result summary
func (b *EinoBrain) ExecuteCommand(ctx context.Context, result *ChatStreamResult, onChunk func(chunk string) error) (string, error) {
	if !result.HasCommand || result.Command == nil {
		return result.Content, nil
	}

	// Extract command parameters
	targetAgentID, ok := result.Command["target_agent_id"].(float64)
	if !ok {
		return "", fmt.Errorf("invalid target_agent_id")
	}
	command, ok := result.Command["command"].(string)
	if !ok {
		return "", fmt.Errorf("invalid command")
	}
	reasoning, _ := result.Command["reasoning"].(string)

	log.Printf("[Butler Brain] Executing command: %s to agent %d", command, int(targetAgentID))

	// Execute the command directly (already approved)
	cmdResult, err := ExecuteCommandDirect(ctx, int(targetAgentID), command, reasoning)
	if err != nil {
		cmdResult = fmt.Sprintf("Tool error: %v", err)
	}

	// Inject result into history and get summary
	b.historyMu.Lock()
	b.history[result.SessionID] = append(b.history[result.SessionID], schema.UserMessage("SYSTEM: Tool result was: "+cmdResult))

	// Stream the final summary
	streamReader, err := b.chatModel.Stream(ctx, b.history[result.SessionID])
	if err != nil {
		b.historyMu.Unlock()
		return "", err
	}

	var finalReply strings.Builder
	defer streamReader.Close()

	for {
		chunk, err := streamReader.Recv()
		if err == io.EOF {
			break
		}
		if err != nil {
			break
		}
		if chunk != nil && chunk.Content != "" {
			finalReply.WriteString(chunk.Content)
			_ = onChunk(chunk.Content)
		}
	}

	content := finalReply.String()
	// Remove any accidental new command lines
	content = commandRegex.ReplaceAllString(content, "")
	b.history[result.SessionID] = append(b.history[result.SessionID], &schema.Message{Role: schema.Assistant, Content: content})
	b.trimHistory(result.SessionID)
	b.historyMu.Unlock()

	return content, nil
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
