package butler

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/cloudwego/eino-ext/components/model/openai"
	"github.com/cloudwego/eino/compose"
	"github.com/cloudwego/eino/schema"
	"github.com/lea/echocenter/backend/internal/observability"
)

const (
	defaultRuntimeRouterTimeout      = 15 * time.Second
	defaultRuntimeRouterMaxQuestions = 2
	runtimeQuestionPrefix            = "[RUNTIME-QUESTION]"
)

type RuntimeRouterConfig struct {
	Enabled      bool
	BaseURL      string
	APIToken     string
	Model        string
	Timeout      time.Duration
	MaxQuestions int
}

type runtimeAgentProfile struct {
	ID       int    `json:"id"`
	Username string `json:"username"`
	Role     string `json:"role"`
}

type runtimeRouterPlan struct {
	ShouldAsk bool                   `json:"should_ask"`
	Reason    string                 `json:"reason"`
	Questions []runtimeAgentQuestion `json:"questions"`
}

type runtimeAgentQuestion struct {
	AgentID   int    `json:"agent_id"`
	Question  string `json:"question"`
	Rationale string `json:"rationale"`
}

type runtimeRouter interface {
	Plan(ctx context.Context, userQuestion string, agents []runtimeAgentProfile) (*runtimeRouterPlan, error)
}

type llmRuntimeRouter struct {
	chain        compose.Runnable[runtimeRouterInput, string]
	maxQuestions int
}

type runtimeRouterInput struct {
	UserQuestion string
	Agents       []runtimeAgentProfile
	MaxQuestions int
}

func newRuntimeRouterConfig(baseURL, apiToken, model string) RuntimeRouterConfig {
	return RuntimeRouterConfig{
		Enabled:      true,
		BaseURL:      baseURL,
		APIToken:     apiToken,
		Model:        model,
		Timeout:      defaultRuntimeRouterTimeout,
		MaxQuestions: defaultRuntimeRouterMaxQuestions,
	}
}

func (c RuntimeRouterConfig) withDefaults() RuntimeRouterConfig {
	cfg := c
	if cfg.Timeout <= 0 {
		cfg.Timeout = defaultRuntimeRouterTimeout
	}
	if cfg.MaxQuestions <= 0 {
		cfg.MaxQuestions = defaultRuntimeRouterMaxQuestions
	}
	return cfg
}

func newRuntimeRouter(baseURL, apiToken, model string, cfg RuntimeRouterConfig) runtimeRouter {
	cfg = cfg.withDefaults()
	if !cfg.Enabled || baseURL == "" {
		return nil
	}

	chatModel, err := openai.NewChatModel(context.Background(), &openai.ChatModelConfig{
		BaseURL: baseURL,
		Model:   model,
		APIKey:  apiToken,
	})
	if err != nil {
		log.Printf("[Butler] Failed to initialize runtime router model: %v", err)
		return nil
	}

	builder := compose.NewChain[runtimeRouterInput, string]()
	builder.AppendLambda(compose.InvokableLambda(func(ctx context.Context, input runtimeRouterInput) ([]*schema.Message, error) {
		return []*schema.Message{
			schema.SystemMessage(runtimeRouterSystemPrompt),
			schema.UserMessage(buildRuntimeRouterPrompt(input)),
		}, nil
	}))
	builder.AppendChatModel(chatModel)
	builder.AppendLambda(compose.InvokableLambda(func(ctx context.Context, resp *schema.Message) (string, error) {
		return strings.TrimSpace(resp.Content), nil
	}))

	chain, err := builder.Compile(context.Background())
	if err != nil {
		log.Printf("[Butler] Failed to compile runtime router chain: %v", err)
		return nil
	}

	return &llmRuntimeRouter{
		chain:        chain,
		maxQuestions: cfg.MaxQuestions,
	}
}

func (r *llmRuntimeRouter) Plan(ctx context.Context, userQuestion string, agents []runtimeAgentProfile) (*runtimeRouterPlan, error) {
	if r == nil || r.chain == nil {
		return &runtimeRouterPlan{}, nil
	}

	raw, err := r.chain.Invoke(ctx, runtimeRouterInput{
		UserQuestion: userQuestion,
		Agents:       agents,
		MaxQuestions: r.maxQuestions,
	})
	if err != nil {
		return nil, err
	}

	plan, err := parseRuntimeRouterPlan(raw)
	if err != nil {
		return nil, err
	}
	return plan, nil
}

func parseRuntimeRouterPlan(raw string) (*runtimeRouterPlan, error) {
	cleaned := strings.TrimSpace(raw)
	cleaned = strings.TrimPrefix(cleaned, "```json")
	cleaned = strings.TrimPrefix(cleaned, "```")
	cleaned = strings.TrimSuffix(cleaned, "```")
	cleaned = strings.TrimSpace(cleaned)

	var plan runtimeRouterPlan
	if err := json.Unmarshal([]byte(cleaned), &plan); err != nil {
		return nil, fmt.Errorf("parse runtime router plan: %w", err)
	}
	return &plan, nil
}

func buildRuntimeRouterPrompt(input runtimeRouterInput) string {
	var builder strings.Builder
	builder.WriteString("User question:\n")
	builder.WriteString(input.UserQuestion)
	builder.WriteString("\n\nOnline agents you may consult:\n")
	for _, agent := range input.Agents {
		builder.WriteString(fmt.Sprintf("- id=%d name=%s role=%s\n", agent.ID, agent.Username, agent.Role))
	}
	builder.WriteString("\nReturn strict JSON with this schema:\n")
	builder.WriteString("{\"should_ask\":boolean,\"reason\":string,\"questions\":[{\"agent_id\":number,\"question\":string,\"rationale\":string}]}\n")
	builder.WriteString(fmt.Sprintf("Never request more than %d agent questions.\n", input.MaxQuestions))
	builder.WriteString("Only ask other agents when their live knowledge is likely required to answer accurately.\n")
	return builder.String()
}

func (s *ButlerService) buildRuntimeRouterBriefing(ctx context.Context, payload string) string {
	if s == nil || s.router == nil || s.repo == nil || s.hub == nil {
		return ""
	}

	agents, err := s.repo.GetAgents(ctx)
	if err != nil {
		return ""
	}

	var onlineAgents []runtimeAgentProfile
	for _, agent := range agents {
		if agent.ID == s.butlerID || !s.hub.HasClient(agent.ID) {
			continue
		}
		onlineAgents = append(onlineAgents, runtimeAgentProfile{
			ID:       agent.ID,
			Username: agent.Username,
			Role:     agent.Role,
		})
	}
	if len(onlineAgents) == 0 {
		return ""
	}

	routerCtx, cancel := context.WithTimeout(ctx, s.runtimeRouterConfig.Timeout)
	defer cancel()

	spanCtx, span := observability.StartSpan(routerCtx, "butler.runtime_router", "agent")
	defer span.Finish(spanCtx)
	span.SetInput(spanCtx, map[string]any{
		"user_question": payload,
		"online_agents": onlineAgents,
	})

	plan, err := s.router.Plan(spanCtx, payload, onlineAgents)
	if err != nil {
		span.SetStatusCode(spanCtx, 1)
		span.SetError(spanCtx, err)
		log.Printf("[Butler] Runtime router failed: %v", err)
		return ""
	}

	if plan == nil || !plan.ShouldAsk || len(plan.Questions) == 0 {
		span.SetOutput(spanCtx, map[string]any{
			"should_ask": false,
			"reason":     planReason(plan),
		})
		return ""
	}

	limit := s.runtimeRouterConfig.MaxQuestions
	if limit <= 0 {
		limit = defaultRuntimeRouterMaxQuestions
	}
	if len(plan.Questions) > limit {
		plan.Questions = plan.Questions[:limit]
	}

	agentNames := make(map[int]string, len(onlineAgents))
	for _, agent := range onlineAgents {
		agentNames[agent.ID] = agent.Username
	}

	var findings []string
	for _, question := range plan.Questions {
		answer, err := s.askAgentRuntimeQuestion(spanCtx, question.AgentID, question.Question)
		agentLabel := runtimeAgentLabel(question.AgentID, agentNames[question.AgentID])
		if err != nil {
			findings = append(findings, fmt.Sprintf("- %s unavailable: %v", agentLabel, err))
			continue
		}
		findings = append(findings, fmt.Sprintf("- %s said: %s", agentLabel, answer))
	}

	if len(findings) == 0 {
		span.SetOutput(spanCtx, map[string]any{
			"should_ask":      true,
			"questions_count": len(plan.Questions),
			"findings_count":  0,
		})
		return ""
	}

	span.SetOutput(spanCtx, map[string]any{
		"should_ask":      true,
		"questions_count": len(plan.Questions),
		"findings_count":  len(findings),
	})

	return buildRuntimeRouterBriefing(plan.Reason, findings)
}

func planReason(plan *runtimeRouterPlan) string {
	if plan == nil {
		return ""
	}
	return plan.Reason
}

func buildRuntimeRouterBriefing(reason string, findings []string) string {
	var builder strings.Builder
	builder.WriteString("RUNTIME ROUTER BRIEFING:\n")
	if strings.TrimSpace(reason) != "" {
		builder.WriteString("Reason for prefetch: ")
		builder.WriteString(reason)
		builder.WriteString("\n")
	}
	builder.WriteString("Agent findings:\n")
	for _, finding := range findings {
		builder.WriteString(finding)
		builder.WriteString("\n")
	}
	return strings.TrimSpace(builder.String())
}

func runtimeAgentLabel(agentID int, username string) string {
	if strings.TrimSpace(username) == "" {
		return fmt.Sprintf("Agent %d", agentID)
	}
	return fmt.Sprintf("%s (ID: %d)", username, agentID)
}

func (s *ButlerService) askAgentRuntimeQuestion(ctx context.Context, agentID int, question string) (string, error) {
	if s == nil || s.hub == nil || !s.hub.HasClient(agentID) {
		return "", fmt.Errorf("agent %d is offline", agentID)
	}

	respChan := make(chan string, 1)
	enqueuePendingResponse(agentID, respChan)
	defer removePendingResponse(agentID, respChan)

	msg := map[string]any{
		"type":        "CHAT",
		"sender_id":   s.butlerID,
		"sender_name": s.butlerName,
		"sender_role": "BUTLER",
		"target_id":   agentID,
		"payload":     fmt.Sprintf("%s %s", runtimeQuestionPrefix, question),
	}
	s.hub.BroadcastGeneric(msg)

	select {
	case response := <-respChan:
		return strings.TrimSpace(response), nil
	case <-ctx.Done():
		return "", ctx.Err()
	case <-time.After(agentResponseTimeout):
		return "", fmt.Errorf("agent %d timed out", agentID)
	}
}

const runtimeRouterSystemPrompt = `You are a runtime-only router for EchoCenter Butler.

Decide whether Butler should first ask one or more connected agents for fresh operational facts before answering the user.

Rules:
1. Prefer asking agents only when live operational context is needed.
2. Do not ask agents for general reasoning that Butler can do itself.
3. Keep questions concise and factual.
4. Return strict JSON only.`

func RuntimeQuestionPrefix() string {
	return runtimeQuestionPrefix
}
