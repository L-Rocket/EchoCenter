package butler

import (
	"context"
	"strings"
	"testing"
)

func TestParseRuntimeRouterPlan_StripsCodeFence(t *testing.T) {
	raw := "```json\n{\"should_ask\":true,\"reason\":\"need live status\",\"questions\":[{\"agent_id\":7,\"question\":\"status?\",\"rationale\":\"fresh context\"}]}\n```"

	plan, err := parseRuntimeRouterPlan(raw)
	if err != nil {
		t.Fatalf("expected plan to parse, got error: %v", err)
	}

	if !plan.ShouldAsk {
		t.Fatalf("expected should_ask=true")
	}
	if plan.Reason != "need live status" {
		t.Fatalf("unexpected reason: %q", plan.Reason)
	}
	if len(plan.Questions) != 1 {
		t.Fatalf("expected 1 question, got %d", len(plan.Questions))
	}
	if plan.Questions[0].AgentID != 7 {
		t.Fatalf("unexpected agent id: %d", plan.Questions[0].AgentID)
	}
}

func TestBuildRuntimeRouterPrompt_IncludesQuestionCap(t *testing.T) {
	prompt := buildRuntimeRouterPrompt(runtimeRouterInput{
		UserQuestion: "Can deployment agent confirm the latest rollout?",
		Agents: []runtimeAgentProfile{
			{ID: 7, Username: "deploy-bot", Role: "deployment"},
		},
		MaxQuestions: 3,
	})

	if !strings.Contains(prompt, "deploy-bot") {
		t.Fatalf("expected prompt to include online agent details")
	}
	if !strings.Contains(prompt, "Never request more than 3 agent questions.") {
		t.Fatalf("expected prompt to include max question guard")
	}
}

func TestBuildRuntimeRouterBriefing_IncludesReasonAndFindings(t *testing.T) {
	briefing := buildRuntimeRouterBriefing("need live status", []string{
		"- deploy-bot (ID: 7) said: rollout is healthy",
	})

	if !strings.Contains(briefing, "RUNTIME ROUTER BRIEFING") {
		t.Fatalf("expected runtime router heading")
	}
	if !strings.Contains(briefing, "Reason for prefetch: need live status") {
		t.Fatalf("expected reason in briefing")
	}
	if !strings.Contains(briefing, "rollout is healthy") {
		t.Fatalf("expected findings in briefing")
	}
}

func TestRuntimeAgentLabel_UsesUsernameWhenAvailable(t *testing.T) {
	if got := runtimeAgentLabel(7, "deploy-bot"); got != "deploy-bot (ID: 7)" {
		t.Fatalf("unexpected label: %q", got)
	}
	if got := runtimeAgentLabel(7, ""); got != "Agent 7" {
		t.Fatalf("unexpected fallback label: %q", got)
	}
}

func TestDelegateResearchToolInfo(t *testing.T) {
	info, err := (&DelegateResearchTool{}).Info(context.Background())
	if err != nil {
		t.Fatalf("expected tool info, got error: %v", err)
	}
	if info.Name != "delegate_research" {
		t.Fatalf("unexpected tool name: %q", info.Name)
	}
}

func TestDelegateResearchToolRejectsEmptyQuestion(t *testing.T) {
	result, err := (&DelegateResearchTool{}).InvokableRun(context.Background(), `{"question":"   "}`)
	if err != nil {
		t.Fatalf("expected empty-question guard, got error: %v", err)
	}
	if !strings.Contains(result, "no question was provided") {
		t.Fatalf("unexpected result: %q", result)
	}
}
