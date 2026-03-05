package butler

import "testing"

func TestParseTargetAgentID(t *testing.T) {
	tests := []struct {
		name  string
		input any
		want  int
	}{
		{name: "float64", input: float64(7), want: 7},
		{name: "int", input: 8, want: 8},
		{name: "string", input: "9", want: 9},
		{name: "invalid string", input: "abc", want: 0},
		{name: "nil", input: nil, want: 0},
	}

	for _, tt := range tests {
		got := parseTargetAgentID(tt.input)
		if got != tt.want {
			t.Fatalf("%s: got %d, want %d", tt.name, got, tt.want)
		}
	}
}

func TestStoreAndPopPendingCommand(t *testing.T) {
	pendingCommandsMu.Lock()
	pendingCommands = make(map[string]*ChatStreamResult)
	pendingCommandsMu.Unlock()

	streamID := "stream-1"
	result := &ChatStreamResult{
		Content:    "reply",
		HasCommand: true,
		Command: map[string]any{
			"target_agent_id": float64(1),
			"command":         "status",
		},
	}

	storePendingCommand(streamID, result)

	got, ok := popPendingCommand(streamID)
	if !ok {
		t.Fatalf("expected pending command to exist")
	}
	if got != result {
		t.Fatalf("expected same pointer after pop")
	}

	if _, ok := popPendingCommand(streamID); ok {
		t.Fatalf("expected pending command to be removed after pop")
	}
}
