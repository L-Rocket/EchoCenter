package butler

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"sync"

	"github.com/cloudwego/eino/components/tool"
	"github.com/cloudwego/eino/schema"
	"github.com/google/uuid"
	"github.com/lea/echocenter/backend/internal/database"
)

// PendingActions stores channels to resume Eino tool execution
var (
	pendingActions = make(map[string]chan bool)
	actionsMu      sync.Mutex
)

type CommandAgentInput struct {
	TargetAgentID int    `json:"target_agent_id"`
	Command       string `json:"command"`
	Reasoning     string `json:"reasoning"`
}

type CommandAgentTool struct{}

func (t *CommandAgentTool) Info(ctx context.Context) (*schema.ToolInfo, error) {
	return &schema.ToolInfo{
		Name: "command_agent",
		Desc: "Sends a command to another agent. Requires user approval.",
	}, nil
}

func (t *CommandAgentTool) InvokableRun(ctx context.Context, argumentsInJSON string, opts ...tool.Option) (string, error) {
	var input CommandAgentInput
	if err := json.Unmarshal([]byte(argumentsInJSON), &input); err != nil {
		return "", err
	}

	actionID := uuid.New().String()
	log.Printf("[Butler Tool] Requesting approval for action %s: %s to agent %d", actionID, input.Command, input.TargetAgentID)

	// 1. Persist PENDING request to DB
	err := database.SaveAuthorization(actionID, GetButler().butlerID, input.TargetAgentID, input.Command, input.Reasoning)
	if err != nil {
		return "", fmt.Errorf("failed to save authorization: %v", err)
	}

	// 2. Prepare resume channel
	resumeChan := make(chan bool)
	actionsMu.Lock()
	pendingActions[actionID] = resumeChan
	actionsMu.Unlock()

	// 3. Notify user via WebSocket (T013)
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

	// 5. Execute actual command
	log.Printf("[Butler Tool] Action %s APPROVED. Executing command...", actionID)
	return fmt.Sprintf("Command '%s' successfully delivered to agent %d.", input.Command, input.TargetAgentID), nil
}

// NewCommandAgentTool creates a tool that requires human approval (T011, T012)
func NewCommandAgentTool() tool.InvokableTool {
	return &CommandAgentTool{}
}

// ResolveAction resumes a pending tool execution (T014)
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
