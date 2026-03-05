package butler

import (
	"context"
	"fmt"
	"io"
	"log"
	"time"

	"github.com/cloudwego/eino/schema"
)

// ChatStreamResult represents the result of a chat stream.
type ChatStreamResult struct {
	Content    string         // The natural language content streamed to user.
	Command    map[string]any // The detected command (if any).
	HasCommand bool           // Whether a command was detected.
	SessionID  string         // Session ID for continuation.
	CreatedAt  time.Time      // When this result was created.
}

func (b *EinoBrain) Chat(ctx context.Context, sessionID, input, systemState string) (string, error) {
	if b.chatModel == nil {
		return safeModeReply, nil
	}

	msgs := b.prepareConversation(sessionID, input, systemState)

	resp, err := b.chatModel.Generate(ctx, msgs)
	if err != nil {
		return "", err
	}

	content := resp.Content
	jsonParams, hasCommand := extractCommandJSON(content)
	if !hasCommand {
		b.appendHistory(sessionID, resp)
		return content, nil
	}

	if _, err := decodeCommandJSON(jsonParams); err != nil {
		log.Printf("[Butler Brain] Invalid command JSON: %v", err)
		return content, nil
	}

	log.Printf("[Butler Brain] Intercepted manual command: %s", jsonParams)
	tool := NewCommandAgentTool()
	result, err := tool.InvokableRun(ctx, jsonParams)
	if err != nil {
		result = fmt.Sprintf("Tool error: %v", err)
	}

	b.historyMu.Lock()
	b.history[sessionID] = append(b.history[sessionID], resp)
	b.history[sessionID] = append(b.history[sessionID], schema.UserMessage("SYSTEM: Tool result was: "+result))

	finalResp, finalErr := b.chatModel.Generate(ctx, b.history[sessionID])
	if finalErr != nil {
		log.Printf("[Butler Brain] Failed to generate post-tool summary: %v", finalErr)
	} else if finalResp != nil {
		content = stripCommandFromContent(finalResp.Content)
		b.history[sessionID] = append(b.history[sessionID], finalResp)
	}

	b.trimHistory(sessionID)
	b.historyMu.Unlock()

	return content, nil
}

// ChatStream streams the response and detects commands.
// Returns when either: 1) complete response without command, or 2) command detected.
func (b *EinoBrain) ChatStream(ctx context.Context, sessionID, input, systemState string, onChunk func(chunk string) error) (*ChatStreamResult, error) {
	if b.chatModel == nil {
		_ = onChunk(safeModeReply)
		return &ChatStreamResult{
			Content:    safeModeReply,
			HasCommand: false,
			SessionID:  sessionID,
			CreatedAt:  time.Now(),
		}, nil
	}

	msgs := b.prepareConversation(sessionID, input, systemState)

	streamReader, err := b.chatModel.Stream(ctx, msgs)
	if err != nil {
		return nil, err
	}
	defer streamReader.Close()

	parser := newStreamCommandParser()

	for {
		chunk, err := streamReader.Recv()
		if err == io.EOF {
			break
		}
		if err != nil {
			return &ChatStreamResult{
				Content:    parser.content(),
				HasCommand: false,
				SessionID:  sessionID,
				CreatedAt:  time.Now(),
			}, err
		}
		if chunk == nil || chunk.Content == "" {
			continue
		}

		emit, shouldStop := parser.consumeChunk(chunk.Content)
		if emit != "" {
			_ = onChunk(emit)
		}
		if shouldStop {
			log.Printf("[ChatStream] Command complete, stopping stream")
			break
		}
	}

	if remaining := parser.flushRemaining(); remaining != "" {
		_ = onChunk(remaining)
	}

	content := parser.content()
	cmdStr := parser.commandText()

	if cmdMap, jsonParams, ok := parseCommandFromContent(cmdStr); ok {
		log.Printf("[Butler Brain] Detected command: %s", jsonParams)
		b.appendHistory(sessionID, &schema.Message{Role: schema.Assistant, Content: content + cmdStr})
		return &ChatStreamResult{
			Content:    content,
			Command:    cmdMap,
			HasCommand: true,
			SessionID:  sessionID,
			CreatedAt:  time.Now(),
		}, nil
	}

	b.appendHistory(sessionID, &schema.Message{Role: schema.Assistant, Content: content})
	return &ChatStreamResult{
		Content:    content,
		HasCommand: false,
		SessionID:  sessionID,
		CreatedAt:  time.Now(),
	}, nil
}
