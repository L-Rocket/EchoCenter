package butler

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/cloudwego/eino/components/tool"
	"github.com/cloudwego/eino/schema"
	"github.com/google/uuid"
	"github.com/lea/echocenter/backend/internal/models"
	"github.com/lea/echocenter/backend/internal/repository"
)

// PendingActions stores channels to resume Eino tool execution
var (
	pendingActions   = make(map[string]chan bool)
	pendingResponses = make(map[int]chan string)
	actionsMu        sync.Mutex
	repoInstance     repository.Repository
)

// SetRepository sets the repository instance for tools
func SetRepository(repo repository.Repository) {
	repoInstance = repo
}

// CommandAgentInput represents the input for command agent tool
type CommandAgentInput struct {
	TargetAgentID int    `json:"target_agent_id"`
	Command       string `json:"command"`
	Reasoning     string `json:"reasoning"`
}

// CommandAgentTool implements the command agent tool
type CommandAgentTool struct{}

// Info returns tool information
func (t *CommandAgentTool) Info(ctx context.Context) (*schema.ToolInfo, error) {
	return &schema.ToolInfo{
		Name: "command_agent",
		Desc: "Sends a command to another agent. Parameters: target_agent_id (int), command (string), reasoning (string).",
	}, nil
}

// InvokableRun executes the tool
func (t *CommandAgentTool) InvokableRun(ctx context.Context, argumentsInJSON string, opts ...tool.Option) (string, error) {
	var input CommandAgentInput
	if err := json.Unmarshal([]byte(argumentsInJSON), &input); err != nil {
		return "", err
	}

	actionID := uuid.New().String()
	log.Printf("[Butler Tool] Requesting approval for action %s: %s to agent %d", actionID, input.Command, input.TargetAgentID)

	// 1. Persist PENDING request to DB
	if repoInstance != nil {
		auth := &models.ButlerAuthorization{
			ID:              actionID,
			TargetAgentID:   input.TargetAgentID,
			ProposedCommand: input.Command,
			Reasoning:       input.Reasoning,
			Status:          "PENDING",
		}
		if err := repoInstance.SaveAuthorization(ctx, auth); err != nil {
			return "", fmt.Errorf("failed to save authorization: %v", err)
		}
	}

	// 2. Prepare resume channel
	resumeChan := make(chan bool)
	actionsMu.Lock()
	pendingActions[actionID] = resumeChan
	actionsMu.Unlock()

	// 3. Notify user via WebSocket
	if b := GetButler(); b != nil {
		b.RequestAuthorization(actionID, input.TargetAgentID, input.Command, input.Reasoning)
	}

	log.Printf("[Butler Tool] Action %s is now PENDING user approval.", actionID)

	// 4. WAIT for approval
	approved := <-resumeChan

	actionsMu.Lock()
	delete(pendingActions, actionID)
	actionsMu.Unlock()

	if !approved {
		return "Action REJECTED by user.", nil
	}

	// 4.5 Immediate feedback to UI
	if b := GetButler(); b != nil {
		b.hub.BroadcastGeneric(map[string]interface{}{
			"type":        "CHAT_STREAM",
			"sender_id":   b.butlerID,
			"sender_name": b.butlerName,
			"target_id":   1,
			"payload":     "\n\n> Execution started... Connecting to target agent.",
			"stream_id":   "exec_" + actionID,
		})
	}

	// 5. Execute actual command
	log.Printf("[Butler Tool] Action %s APPROVED. Executing command to Agent %d...", actionID, input.TargetAgentID)

	// Prepare to receive response
	respChan := make(chan string, 1)
	actionsMu.Lock()
	pendingResponses[input.TargetAgentID] = respChan
	log.Printf("[Butler Tool] Registered listener for Agent %d response", input.TargetAgentID)
	actionsMu.Unlock()

	// Deliver message to target agent
	if b := GetButler(); b != nil {
		commandMsg := fmt.Sprintf("[DIRECTIVE] %s", input.Command)
		if repoInstance != nil {
			_ = repoInstance.SaveChatMessage(ctx, &models.ChatMessage{
				SenderID:   b.butlerID,
				ReceiverID: input.TargetAgentID,
				Payload:    commandMsg,
			})
		}
		b.hub.BroadcastGeneric(map[string]interface{}{
			"type":        "CHAT",
			"sender_id":   b.butlerID,
			"sender_name": b.butlerName,
			"target_id":   input.TargetAgentID,
			"payload":     commandMsg,
		})
	}

	// 6. WAIT for the agent to report back (max 30s)
	log.Printf("[Butler Tool] Waiting for Agent %d to reply...", input.TargetAgentID)
	select {
	case realResult := <-respChan:
		log.Printf("[Butler Tool] Received REAL response from Agent %d: %s", input.TargetAgentID, truncateString(realResult, 20))
		return realResult, nil
	case <-time.After(30 * time.Second):
		actionsMu.Lock()
		delete(pendingResponses, input.TargetAgentID)
		actionsMu.Unlock()
		log.Printf("[Butler Tool] TIMEOUT waiting for Agent %d", input.TargetAgentID)
		return "Timeout: Target agent did not respond within 30 seconds.", nil
	}
}

// truncateString truncates a string to max length
func truncateString(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen] + "..."
}

// RegisterAgentResponse allows the Hub to feed agent replies back to the tool
func RegisterAgentResponse(agentID int, payload string) bool {
	actionsMu.Lock()
	ch, ok := pendingResponses[agentID]
	log.Printf("[Butler Registry] Checking for listener ID %d... Found: %v", agentID, ok)
	if ok {
		delete(pendingResponses, agentID)
	}
	actionsMu.Unlock()

	if ok {
		select {
		case ch <- payload:
			log.Printf("[Butler Registry] Successfully fed payload to listener ID %d", agentID)
			return true
		default:
			log.Printf("[Butler Registry] Listener ID %d was not ready or buffer full", agentID)
			return false
		}
	}
	return false
}

// NewCommandAgentTool creates a tool that requires human approval
func NewCommandAgentTool() tool.InvokableTool {
	return &CommandAgentTool{}
}

// ResolveAction resumes a pending tool execution
func ResolveAction(actionID string, approved bool) bool {
	actionsMu.Lock()
	ch, ok := pendingActions[actionID]
	actionsMu.Unlock()

	if ok {
		ch <- approved
		return true
	}
	return false
}
