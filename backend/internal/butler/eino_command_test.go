package butler

import (
	"reflect"
	"testing"
)

func TestParseCommandFromContent_Valid(t *testing.T) {
	content := `Please execute this.
COMMAND_AGENT: {"target_agent_id": 7, "command": "status", "reasoning": "quick check"}`

	cmdMap, jsonParams, ok := parseCommandFromContent(content)
	if !ok {
		t.Fatalf("expected command to be parsed")
	}
	if jsonParams == "" {
		t.Fatalf("expected non-empty json params")
	}

	if got := int(cmdMap["target_agent_id"].(float64)); got != 7 {
		t.Fatalf("unexpected target_agent_id: %d", got)
	}
	if got := cmdMap["command"].(string); got != "status" {
		t.Fatalf("unexpected command: %s", got)
	}
}

func TestParseCommandFromContent_InvalidJSON(t *testing.T) {
	content := `COMMAND_AGENT: {"target_agent_id": }`

	cmdMap, jsonParams, ok := parseCommandFromContent(content)
	if ok {
		t.Fatalf("expected parse to fail")
	}
	if cmdMap != nil {
		t.Fatalf("expected nil command map")
	}
	if jsonParams == "" {
		t.Fatalf("expected raw json to still be captured")
	}
}

func TestStripCommandFromContent(t *testing.T) {
	content := `Summary before.
COMMAND_AGENT: {"target_agent_id": 1, "command": "ping", "reasoning": "check"}
Summary after.`

	cleaned := stripCommandFromContent(content)
	if cleaned == content {
		t.Fatalf("expected command line to be removed")
	}
	if cleaned != "Summary before.\n\nSummary after." {
		t.Fatalf("unexpected cleaned content: %q", cleaned)
	}
}

func TestParseCommandExecutionInput(t *testing.T) {
	input := map[string]any{
		"target_agent_id": float64(9),
		"command":         "status",
		"reasoning":       "check",
	}

	targetID, commandText, reasoning, err := parseCommandExecutionInput(input)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if targetID != 9 || commandText != "status" || reasoning != "check" {
		t.Fatalf("unexpected parsed values: %d %s %s", targetID, commandText, reasoning)
	}
}

func TestParseCommandExecutionInput_Invalid(t *testing.T) {
	tests := []map[string]any{
		{"command": "status"},
		{"target_agent_id": float64(1)},
		{"target_agent_id": "1", "command": "status"},
	}

	for _, tc := range tests {
		_, _, _, err := parseCommandExecutionInput(tc)
		if err == nil {
			t.Fatalf("expected error for input: %+v", tc)
		}
	}
}

func TestDecodeCommandJSON(t *testing.T) {
	jsonParams := `{"target_agent_id": 2, "command": "ping", "reasoning": "routine"}`
	got, err := decodeCommandJSON(jsonParams)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	want := map[string]any{
		"target_agent_id": float64(2),
		"command":         "ping",
		"reasoning":       "routine",
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("unexpected map: %#v", got)
	}
}
