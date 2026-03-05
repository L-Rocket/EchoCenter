package butler

import (
	"context"
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
		_ = onChunk(chunk.Content)
	}

	content := stripCommandFromContent(finalReply.String())
	b.history[result.SessionID] = append(b.history[result.SessionID], &schema.Message{Role: schema.Assistant, Content: content})
	b.trimHistory(result.SessionID)
	b.historyMu.Unlock()

	return content, nil
}
