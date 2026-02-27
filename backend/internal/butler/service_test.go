package butler

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/lea/echocenter/backend/internal/database"
)

type MockHub struct{}
func (m *MockHub) BroadcastGeneric(msg interface{}) {}

func TestHITLLoop(t *testing.T) {
	// Setup test DB
	database.InitDBPath("./butler_test.db")
	defer database.CloseDB()

	hub := &MockHub{}
	InitButler(1, "my-agent", hub)
	
	tool := NewCommandAgentTool()
	input := CommandAgentInput{
		TargetAgentID: 2,
		Command:       "RESTART",
		Reasoning:     "Test",
	}
	inputJSON, _ := json.Marshal(input)

	// Run tool in goroutine as it will block
	resultChan := make(chan string)
	go func() {
		res, err := tool.InvokableRun(context.Background(), string(inputJSON))
		if err != nil {
			resultChan <- "ERROR"
			return
		}
		resultChan <- res
	}()

	// Wait for tool to generate action and block
	time.Sleep(200 * time.Millisecond)

	// Resolve the action
	actionsMu.Lock()
	var actionID string
	for id := range pendingActions {
		actionID = id
		break
	}
	actionsMu.Unlock()

	if actionID == "" {
		t.Fatal("Action was not recorded as pending")
	}

	// Simulate user approval
	success := ResolveAction(actionID, true)
	if !success {
		t.Fatal("Failed to resolve action")
	}

	// Verify result
	select {
	case res := <-resultChan:
		if res != "Command 'RESTART' successfully delivered to agent 2." {
			t.Errorf("Unexpected result: %s", res)
		}
	case <-time.After(1 * time.Second):
		t.Error("Timed out waiting for tool completion")
	}
}
