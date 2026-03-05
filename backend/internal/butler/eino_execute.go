package butler

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"strings"

	"github.com/cloudwego/eino/schema"
)

// ExecuteCommand executes a command and streams the result summary.
func (b *EinoBrain) ExecuteCommand(ctx context.Context, result *ChatStreamResult, onChunk func(chunk string) error) (string, error) {
	if !result.HasCommand || result.Command == nil {
		return result.Content, nil
	}

	if b.chatModel == nil {
		return safeModeReply, nil
	}

	targetAgentID, commandText, reasoning, err := parseCommandExecutionInput(result.Command)
	if err != nil {
		return "", err
	}

	log.Printf("[Butler Brain] Executing command: %s to agent %d", commandText, targetAgentID)

	cmdResult, err := ExecuteCommandDirect(ctx, targetAgentID, commandText, reasoning)
	if err != nil {
		cmdResult = fmt.Sprintf("Tool error: %v", err)
	}

	b.historyMu.Lock()
	b.history[result.SessionID] = append(b.history[result.SessionID], schema.UserMessage("SYSTEM: Tool result was: "+cmdResult))

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
		if chunk == nil || chunk.Content == "" {
			continue
		}

		finalReply.WriteString(chunk.Content)
	}

	content := sanitizePostToolReply(stripCommandFromContent(finalReply.String()))
	if content == "" {
		content = summarizeToolResult(cmdResult)
	}
	if content != "" {
		_ = onChunk(content)
	}
	b.history[result.SessionID] = append(b.history[result.SessionID], &schema.Message{Role: schema.Assistant, Content: content})
	b.trimHistory(result.SessionID)
	b.historyMu.Unlock()

	return content, nil
}

func sanitizePostToolReply(raw string) string {
	out := strings.TrimSpace(raw)
	lower := strings.ToLower(out)
	prefix := "system: tool result was"
	if strings.HasPrefix(lower, prefix) {
		out = strings.TrimSpace(out[len(prefix):])
		out = strings.TrimSpace(strings.TrimPrefix(out, ":"))
	}
	return strings.TrimSpace(out)
}

func summarizeToolResult(raw string) string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return ""
	}

	var obj map[string]any
	if err := json.Unmarshal([]byte(trimmed), &obj); err != nil {
		return trimmed
	}

	status, _ := obj["status"].(string)
	role, _ := obj["role"].(string)
	task, _ := obj["current_task"].(string)

	agentID := parseTargetAgentID(obj["target_agent_id"])
	if role == "" {
		role = fmt.Sprintf("Agent %d", agentID)
	}

	if status == "" && task == "" {
		return trimmed
	}
	if task == "" {
		return fmt.Sprintf("%s (ID: %d) status: %s.", role, agentID, status)
	}
	if status == "" {
		return fmt.Sprintf("%s (ID: %d) current task: %s.", role, agentID, task)
	}
	return fmt.Sprintf("%s (ID: %d) is %s. Current task: %s.", role, agentID, status, task)
}
