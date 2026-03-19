package butler

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strings"
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
	pendingResponses = make(map[int][]chan string)
	actionsMu        sync.Mutex
	repoInstance     repository.Repository
)

const agentResponseTimeout = 30 * time.Second

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

// DelegateResearchInput represents the input for delegated runtime research.
type DelegateResearchInput struct {
	Question  string `json:"question"`
	Reasoning string `json:"reasoning"`
}

// DelegateResearchTool asks relevant online agents for fresh facts without exposing
// the runtime routing exchange in the user-visible conversation history.
type DelegateResearchTool struct{}

// Info returns tool information.
func (t *DelegateResearchTool) Info(ctx context.Context) (*schema.ToolInfo, error) {
	return &schema.ToolInfo{
		Name: "delegate_research",
		Desc: "Asks relevant online agents for fresh operational facts. Parameters: question (string), reasoning (string). Use this when you need live status or recent system facts before answering the user.",
	}, nil
}

// InvokableRun executes runtime research and returns a briefing for Butler to summarize.
func (t *DelegateResearchTool) InvokableRun(ctx context.Context, argumentsInJSON string, opts ...tool.Option) (string, error) {
	var input DelegateResearchInput
	if err := json.Unmarshal([]byte(argumentsInJSON), &input); err != nil {
		return "", err
	}

	b := GetButler()
	if b == nil {
		return "Runtime research unavailable because Butler service is not initialized.", nil
	}

	question := strings.TrimSpace(input.Question)
	if question == "" {
		return "Runtime research skipped because no question was provided.", nil
	}

	briefing := b.buildRuntimeRouterBriefing(ctx, question)
	if strings.TrimSpace(briefing) == "" {
		return "No additional live agent findings were needed or available.", nil
	}

	return briefing, nil
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

	// Early check: if target agent is offline, return immediately without waiting
	b := GetButler()
	if b != nil && b.hub != nil && !b.hub.HasClient(input.TargetAgentID) {
		log.Printf("[Butler Tool] Target Agent %d is OFFLINE, skipping approval request and returning immediately", input.TargetAgentID)
		return fmt.Sprintf("Target agent %d is offline (not connected). Command not sent.", input.TargetAgentID), nil
	}

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
	if b != nil {
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

	// Re-check agent is still online after approval
	if b != nil && b.hub != nil && !b.hub.HasClient(input.TargetAgentID) {
		log.Printf("[Butler Tool] Target Agent %d went OFFLINE after approval, returning immediately without waiting", input.TargetAgentID)
		return fmt.Sprintf("Target agent %d is now offline. Command not executed.", input.TargetAgentID), nil
	}

	// 4.5 Immediate feedback to UI
	if b != nil {
		b.hub.BroadcastGeneric(map[string]any{
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
	enqueuePendingResponse(input.TargetAgentID, respChan)
	log.Printf("[Butler Tool] Registered listener for Agent %d response", input.TargetAgentID)

	// Deliver message to target agent
	if b != nil {
		commandMsg := fmt.Sprintf("[DIRECTIVE] %s", input.Command)
		chatMsg := &models.ChatMessage{
			SenderID:   b.butlerID,
			ReceiverID: input.TargetAgentID,
			Payload:    commandMsg,
		}
		if repoInstance != nil {
			_ = repoInstance.SaveChatMessage(ctx, chatMsg)
		}
		msg := map[string]any{
			"type":        "CHAT",
			"sender_id":   b.butlerID,
			"sender_name": b.butlerName,
			"sender_role": "BUTLER",
			"target_id":   input.TargetAgentID,
			"payload":     commandMsg,
		}
		if chatMsg.ID > 0 {
			msg["id"] = chatMsg.ID
			msg["timestamp"] = chatMsg.Timestamp.Format(time.RFC3339Nano)
		}
		b.hub.BroadcastGeneric(msg)
	}

	// 6. WAIT for the agent to report back (only if agent is actually online)
	log.Printf("[Butler Tool] Waiting for Agent %d to reply...", input.TargetAgentID)
	select {
	case realResult := <-respChan:
		log.Printf("[Butler Tool] Received REAL response from Agent %d: %s", input.TargetAgentID, truncateString(realResult, 20))
		return realResult, nil
	case <-time.After(agentResponseTimeout):
		removePendingResponse(input.TargetAgentID, respChan)
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
	ch, ok := popPendingResponse(agentID)
	log.Printf("[Butler Registry] Checking for listener ID %d... Found: %v", agentID, ok)

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

// NewDelegateResearchTool creates a runtime-only research tool.
func NewDelegateResearchTool() tool.InvokableTool {
	return &DelegateResearchTool{}
}

func enqueuePendingResponse(agentID int, ch chan string) {
	actionsMu.Lock()
	defer actionsMu.Unlock()
	pendingResponses[agentID] = append(pendingResponses[agentID], ch)
}

func popPendingResponse(agentID int) (chan string, bool) {
	actionsMu.Lock()
	defer actionsMu.Unlock()

	queue := pendingResponses[agentID]
	if len(queue) == 0 {
		return nil, false
	}

	ch := queue[0]
	if len(queue) == 1 {
		delete(pendingResponses, agentID)
	} else {
		pendingResponses[agentID] = queue[1:]
	}

	return ch, true
}

func removePendingResponse(agentID int, target chan string) {
	actionsMu.Lock()
	defer actionsMu.Unlock()

	queue := pendingResponses[agentID]
	if len(queue) == 0 {
		return
	}

	for i, ch := range queue {
		if ch != target {
			continue
		}

		queue = append(queue[:i], queue[i+1:]...)
		if len(queue) == 0 {
			delete(pendingResponses, agentID)
		} else {
			pendingResponses[agentID] = queue
		}
		return
	}
}

// ResolveAction resumes a pending tool execution or command
func ResolveAction(actionID string, approved bool) bool {
	// First check pendingActions (for tool execution)
	actionsMu.Lock()
	ch, ok := pendingActions[actionID]
	actionsMu.Unlock()

	if ok {
		log.Printf("[Butler ResolveAction] Found action %s in pendingActions", actionID)
		select {
		case ch <- approved:
			log.Printf("[Butler ResolveAction] Successfully sent approval=%v for action %s", approved, actionID)
			return true
		default:
			log.Printf("[Butler ResolveAction] Channel blocked for action %s", actionID)
			return false
		}
	}

	log.Printf("[Butler ResolveAction] Action %s not found in pending actions", actionID)
	return false
}
