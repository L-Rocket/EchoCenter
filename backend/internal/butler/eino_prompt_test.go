package butler

import (
	"strings"
	"testing"
)

func TestBuildButlerSystemPrompt_WithoutState(t *testing.T) {
	prompt := buildButlerSystemPrompt("")

	if !strings.Contains(prompt, "You are the EchoCenter Butler") {
		t.Fatalf("expected base prompt content")
	}
	if strings.Contains(prompt, "CURRENT SYSTEM STATE") {
		t.Fatalf("did not expect system state section when state is empty")
	}
}

func TestBuildButlerSystemPrompt_WithState(t *testing.T) {
	state := "- Agent A (ID: 2, Role: worker)"
	prompt := buildButlerSystemPrompt(state)

	if !strings.Contains(prompt, "CURRENT SYSTEM STATE") {
		t.Fatalf("expected system state section")
	}
	if !strings.Contains(prompt, state) {
		t.Fatalf("expected prompt to include system state")
	}
}
