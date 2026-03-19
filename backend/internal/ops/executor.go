package ops

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/lea/echocenter/backend/internal/config"
	"github.com/lea/echocenter/backend/internal/models"
	"github.com/lea/echocenter/backend/internal/repository"
)

const (
	managedAgentKindOpenHands    = "openhands_ops"
	managedAgentRuntimeOpenHands = "openhands"
	defaultOpenHandsAgentName    = "OpenHands-Ops"
)

type Executor struct {
	repo repository.Repository
	cfg  config.OpenHandsConfig
}

type runnerPayload struct {
	Task         string       `json:"task"`
	Reasoning    string       `json:"reasoning,omitempty"`
	Model        string       `json:"model,omitempty"`
	BaseURL      string       `json:"base_url,omitempty"`
	APIKey       string       `json:"api_key,omitempty"`
	WorkspaceDir string       `json:"workspace_dir,omitempty"`
	Nodes        []runnerNode `json:"nodes"`
}

type runnerNode struct {
	Name       string `json:"name"`
	Host       string `json:"host"`
	Port       int    `json:"port"`
	SSHUser    string `json:"ssh_user"`
	PrivateKey string `json:"private_key"`
	PublicKey  string `json:"public_key,omitempty"`
}

type runnerResponse struct {
	OK      bool   `json:"ok"`
	Summary string `json:"summary"`
	Error   string `json:"error"`
}

var (
	instance *Executor
	mu       sync.RWMutex
)

func Init(repo repository.Repository, cfg config.OpenHandsConfig) error {
	mu.Lock()
	defer mu.Unlock()
	instance = &Executor{repo: repo, cfg: cfg}
	if !cfg.Enabled || repo == nil {
		return nil
	}
	_, err := ensureManagedAgent(context.Background(), repo)
	return err
}

func GetExecutor() *Executor {
	mu.RLock()
	defer mu.RUnlock()
	return instance
}

func (e *Executor) IsManagedAgent(user models.User) bool {
	return strings.EqualFold(strings.TrimSpace(user.AgentKind), managedAgentKindOpenHands) ||
		strings.EqualFold(strings.TrimSpace(user.RuntimeKind), managedAgentRuntimeOpenHands)
}

func (e *Executor) IsAvailable() bool {
	return e != nil && e.cfg.Enabled
}

func (e *Executor) Status(user models.User) (online bool, report string) {
	if !e.IsManagedAgent(user) {
		return false, ""
	}
	if e.IsAvailable() {
		return true, "backend_managed_openhands"
	}
	return false, "openhands_disabled"
}

func (e *Executor) ExecuteAgentCommand(ctx context.Context, task, reasoning string) (string, error) {
	if e == nil || !e.cfg.Enabled {
		return "", fmt.Errorf("OpenHands executor is disabled")
	}
	payload, err := e.buildPayload(ctx, task, reasoning)
	if err != nil {
		return "", err
	}
	return e.run(ctx, payload)
}

func (e *Executor) buildPayload(ctx context.Context, task, reasoning string) (*runnerPayload, error) {
	nodes, err := e.repo.ListInfraNodes(ctx)
	if err != nil {
		return nil, err
	}

	payload := &runnerPayload{
		Task:         task,
		Reasoning:    reasoning,
		Model:        e.cfg.Model,
		BaseURL:      e.cfg.BaseURL,
		APIKey:       e.cfg.APIKey,
		WorkspaceDir: e.cfg.WorkspaceDir,
		Nodes:        make([]runnerNode, 0, len(nodes)),
	}

	for _, node := range nodes {
		key, err := e.repo.GetSSHKeyMaterial(ctx, node.SSHKeyID)
		if err != nil {
			return nil, fmt.Errorf("load ssh key for node %s: %w", node.Name, err)
		}
		payload.Nodes = append(payload.Nodes, runnerNode{
			Name:       node.Name,
			Host:       node.Host,
			Port:       node.Port,
			SSHUser:    node.SSHUser,
			PrivateKey: key.PrivateKey,
			PublicKey:  key.PublicKey,
		})
	}

	return payload, nil
}

func (e *Executor) run(ctx context.Context, payload *runnerPayload) (string, error) {
	if strings.TrimSpace(e.cfg.ServiceURL) != "" {
		return e.runViaService(ctx, payload)
	}

	data, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}

	runnerPath := e.cfg.RunnerScript
	if !filepath.IsAbs(runnerPath) {
		runnerPath = filepath.Clean(runnerPath)
	}

	cmd := exec.CommandContext(ctx, e.cfg.PythonBin, runnerPath)
	cmd.Stdin = bytes.NewReader(data)
	var stdout bytes.Buffer
	var stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	cmd.Env = append(os.Environ(),
		"OPENHANDS_BASE_URL="+e.cfg.BaseURL,
		"OPENHANDS_API_KEY="+e.cfg.APIKey,
		"OPENHANDS_MODEL="+e.cfg.Model,
	)
	if err := cmd.Run(); err != nil {
		return "", fmt.Errorf("OpenHands runner failed: %w (%s)", err, strings.TrimSpace(stderr.String()))
	}

	var resp runnerResponse
	if err := json.Unmarshal(stdout.Bytes(), &resp); err != nil {
		return "", fmt.Errorf("parse OpenHands runner output: %w", err)
	}
	if !resp.OK {
		if resp.Error == "" {
			resp.Error = "OpenHands runner returned an unknown error"
		}
		return "", errors.New(resp.Error)
	}
	return strings.TrimSpace(resp.Summary), nil
}

func (e *Executor) runViaService(ctx context.Context, payload *runnerPayload) (string, error) {
	data, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, strings.TrimRight(e.cfg.ServiceURL, "/")+"/run", bytes.NewReader(data))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("OpenHands service request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("read OpenHands service response: %w", err)
	}

	var result runnerResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return "", fmt.Errorf("parse OpenHands service response: %w", err)
	}
	if resp.StatusCode >= 400 || !result.OK {
		if result.Error == "" {
			result.Error = strings.TrimSpace(string(body))
		}
		if result.Error == "" {
			result.Error = fmt.Sprintf("OpenHands service returned HTTP %d", resp.StatusCode)
		}
		return "", errors.New(result.Error)
	}
	return strings.TrimSpace(result.Summary), nil
}

func ensureManagedAgent(ctx context.Context, repo repository.Repository) (*models.User, error) {
	existing, err := repo.GetUserByUsername(ctx, defaultOpenHandsAgentName)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return existing, nil
	}

	agent := &models.User{
		Username:     defaultOpenHandsAgentName,
		PasswordHash: "AGENT_TOKEN_ONLY",
		Role:         "AGENT",
		ActorType:    "SYSTEM",
		AgentKind:    managedAgentKindOpenHands,
		RuntimeKind:  managedAgentRuntimeOpenHands,
		Description:  "Backend-managed operations agent powered by OpenHands.",
	}
	if err := repo.CreateUser(ctx, agent); err != nil {
		return nil, err
	}
	return agent, nil
}

func DefaultManagedAgentName() string {
	return defaultOpenHandsAgentName
}

func ManagedAgentKind() string {
	return managedAgentKindOpenHands
}

func ManagedRuntimeKind() string {
	return managedAgentRuntimeOpenHands
}

func RunTimeout() time.Duration {
	return 5 * time.Minute
}
