package ops

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/lea/echocenter/backend/internal/config"
	"github.com/lea/echocenter/backend/internal/models"
	"github.com/lea/echocenter/backend/internal/repository"
	apperrors "github.com/lea/echocenter/backend/pkg/errors"
	"golang.org/x/crypto/ssh"
)

const (
	managedAgentKindOpenHands    = "openhands_ops"
	managedAgentRuntimeOpenHands = "openhands"
	defaultOpenHandsAgentName    = "OpenHands-Ops"
)

type Executor struct {
	repo repository.Repository
	cfg  config.OpenHandsConfig
	mu   sync.RWMutex
	jobs []models.OpenHandsTaskRecord
}

type runnerPayload struct {
	TaskID       string       `json:"task_id,omitempty"`
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

type runnerTaskStatus struct {
	OK          bool   `json:"ok"`
	TaskID      string `json:"task_id"`
	Status      string `json:"status"`
	CurrentStep string `json:"current_step"`
	LiveOutput  string `json:"live_output"`
	Summary     string `json:"summary"`
	Error       string `json:"error"`
}

type StatusSummary struct {
	Enabled         bool   `json:"enabled"`
	ServiceURL      string `json:"service_url"`
	WorkerReachable bool   `json:"worker_reachable"`
	WorkerMode      string `json:"worker_mode"`
	ManagedAgentID  int    `json:"managed_agent_id"`
	ManagedAgent    string `json:"managed_agent_name"`
	NodeCount       int    `json:"node_count"`
	SSHKeyCount     int    `json:"ssh_key_count"`
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
	record := models.OpenHandsTaskRecord{
		ID:          fmt.Sprintf("openhands-%d", time.Now().UnixNano()),
		Task:        strings.TrimSpace(task),
		Reasoning:   strings.TrimSpace(reasoning),
		StartedAt:   time.Now().UTC(),
		UpdatedAt:   time.Now().UTC(),
		Status:      "running",
		CurrentStep: "Queued for execution",
		WorkerMode:  "local_runner",
	}
	if strings.TrimSpace(e.cfg.ServiceURL) != "" {
		record.WorkerMode = "service"
	}
	payload, err := e.buildPayload(ctx, task, reasoning)
	if err != nil {
		record.FinishedAt = time.Now().UTC()
		record.DurationMS = record.FinishedAt.Sub(record.StartedAt).Milliseconds()
		record.Error = err.Error()
		record.Status = "failed"
		record.UpdatedAt = record.FinishedAt
		e.appendTaskRecord(record)
		return "", err
	}
	payload.TaskID = record.ID
	e.appendTaskRecord(record)
	summary, err := e.run(ctx, payload)
	record.FinishedAt = time.Now().UTC()
	record.DurationMS = record.FinishedAt.Sub(record.StartedAt).Milliseconds()
	if err != nil {
		record.Error = err.Error()
		record.Status = "failed"
		record.UpdatedAt = record.FinishedAt
		e.updateTaskRecord(record)
		return "", err
	}
	record.Success = true
	record.Status = "completed"
	record.Summary = strings.TrimSpace(summary)
	record.LiveOutput = ""
	record.UpdatedAt = record.FinishedAt
	e.updateTaskRecord(record)
	return summary, nil
}

func (e *Executor) TestNodeConnectivity(ctx context.Context, nodeID int) (*models.InfraNodeTestResult, error) {
	if e == nil || e.repo == nil {
		return nil, apperrors.New(apperrors.ErrInternal, "OpenHands executor is not initialized")
	}

	nodes, err := e.repo.ListInfraNodes(ctx)
	if err != nil {
		return nil, err
	}

	var node *models.InfraNode
	for i := range nodes {
		if nodes[i].ID == nodeID {
			node = &nodes[i]
			break
		}
	}
	if node == nil {
		return nil, apperrors.New(apperrors.ErrNotFound, "infra node not found")
	}

	key, err := e.repo.GetSSHKeyMaterial(ctx, node.SSHKeyID)
	if err != nil {
		return nil, err
	}

	result := &models.InfraNodeTestResult{
		NodeID:       nodeID,
		CheckedAtUTC: time.Now().UTC(),
	}

	signer, err := ssh.ParsePrivateKey([]byte(key.PrivateKey))
	if err != nil {
		result.Message = fmt.Sprintf("SSH private key could not be parsed: %v", err)
		return result, nil
	}

	config := &ssh.ClientConfig{
		User:            node.SSHUser,
		Auth:            []ssh.AuthMethod{ssh.PublicKeys(signer)},
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
		Timeout:         5 * time.Second,
	}

	address := net.JoinHostPort(node.Host, strconv.Itoa(node.Port))
	startedAt := time.Now()
	client, err := ssh.Dial("tcp", address, config)
	result.RoundTripMS = time.Since(startedAt).Milliseconds()
	if err != nil {
		result.Message = fmt.Sprintf("SSH handshake failed for %s: %v", address, err)
		return result, nil
	}
	defer client.Close()

	result.OK = true
	result.Message = fmt.Sprintf("SSH handshake succeeded for %s.", address)
	return result, nil
}

func (e *Executor) StatusSummary(ctx context.Context) StatusSummary {
	summary := StatusSummary{
		Enabled:    e != nil && e.cfg.Enabled,
		ServiceURL: strings.TrimSpace(e.cfg.ServiceURL),
	}
	if e == nil {
		return summary
	}

	if summary.ServiceURL != "" {
		summary.WorkerMode = "service"
		summary.WorkerReachable = e.serviceHealthy(ctx)
	} else if strings.TrimSpace(e.cfg.RunnerScript) != "" {
		summary.WorkerMode = "local_runner"
		summary.WorkerReachable = e.cfg.Enabled
	}

	if e.repo != nil {
		if keys, err := e.repo.ListSSHKeys(ctx); err == nil {
			summary.SSHKeyCount = len(keys)
		}
		if nodes, err := e.repo.ListInfraNodes(ctx); err == nil {
			summary.NodeCount = len(nodes)
		}
		if user, err := e.repo.GetUserByUsername(ctx, defaultOpenHandsAgentName); err == nil && user != nil {
			summary.ManagedAgentID = user.ID
			summary.ManagedAgent = user.Username
		}
	}

	return summary
}

func (e *Executor) RecentTasks(limit int) []models.OpenHandsTaskRecord {
	if e == nil {
		return nil
	}
	if limit <= 0 {
		limit = 10
	}

	e.mu.RLock()
	defer e.mu.RUnlock()

	if len(e.jobs) == 0 {
		return []models.OpenHandsTaskRecord{}
	}

	if limit > len(e.jobs) {
		limit = len(e.jobs)
	}

	result := make([]models.OpenHandsTaskRecord, 0, limit)
	for i := len(e.jobs) - 1; i >= 0 && len(result) < limit; i-- {
		result = append(result, e.jobs[i])
	}
	return result
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

	stopPolling := make(chan struct{})
	defer close(stopPolling)
	if strings.TrimSpace(payload.TaskID) != "" {
		go e.pollTaskStatus(ctx, payload.TaskID, stopPolling)
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

func (e *Executor) appendTaskRecord(record models.OpenHandsTaskRecord) {
	if e == nil {
		return
	}
	e.mu.Lock()
	defer e.mu.Unlock()
	e.jobs = append(e.jobs, record)
	if len(e.jobs) > 20 {
		e.jobs = append([]models.OpenHandsTaskRecord(nil), e.jobs[len(e.jobs)-20:]...)
	}
}

func (e *Executor) updateTaskRecord(record models.OpenHandsTaskRecord) {
	if e == nil {
		return
	}
	e.mu.Lock()
	defer e.mu.Unlock()
	for index := range e.jobs {
		if e.jobs[index].ID == record.ID {
			e.jobs[index] = record
			return
		}
	}
	e.jobs = append(e.jobs, record)
	if len(e.jobs) > 20 {
		e.jobs = append([]models.OpenHandsTaskRecord(nil), e.jobs[len(e.jobs)-20:]...)
	}
}

func (e *Executor) updateTaskStatus(taskID string, status runnerTaskStatus) {
	if e == nil || strings.TrimSpace(taskID) == "" {
		return
	}
	e.mu.Lock()
	defer e.mu.Unlock()
	for index := range e.jobs {
		if e.jobs[index].ID != taskID {
			continue
		}
		e.jobs[index].UpdatedAt = time.Now().UTC()
		if strings.TrimSpace(status.Status) != "" {
			e.jobs[index].Status = strings.TrimSpace(status.Status)
		}
		if strings.TrimSpace(status.CurrentStep) != "" {
			e.jobs[index].CurrentStep = strings.TrimSpace(status.CurrentStep)
		}
		if strings.TrimSpace(status.LiveOutput) != "" {
			e.jobs[index].LiveOutput = strings.TrimSpace(status.LiveOutput)
		}
		if strings.TrimSpace(status.Summary) != "" {
			e.jobs[index].Summary = strings.TrimSpace(status.Summary)
		}
		if strings.TrimSpace(status.Error) != "" {
			e.jobs[index].Error = strings.TrimSpace(status.Error)
		}
		return
	}
}

func (e *Executor) pollTaskStatus(ctx context.Context, taskID string, stop <-chan struct{}) {
	if e == nil || strings.TrimSpace(e.cfg.ServiceURL) == "" || strings.TrimSpace(taskID) == "" {
		return
	}
	ticker := time.NewTicker(750 * time.Millisecond)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-stop:
			return
		case <-ticker.C:
			status, err := e.fetchTaskStatus(ctx, taskID)
			if err != nil {
				continue
			}
			e.updateTaskStatus(taskID, *status)
			normalized := strings.ToLower(strings.TrimSpace(status.Status))
			if normalized == "completed" || normalized == "failed" {
				return
			}
		}
	}
}

func (e *Executor) fetchTaskStatus(ctx context.Context, taskID string) (*runnerTaskStatus, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, strings.TrimRight(e.cfg.ServiceURL, "/")+"/tasks/"+taskID, nil)
	if err != nil {
		return nil, err
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("task status returned HTTP %d", resp.StatusCode)
	}
	var result runnerTaskStatus
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

func (e *Executor) serviceHealthy(ctx context.Context) bool {
	if strings.TrimSpace(e.cfg.ServiceURL) == "" {
		return false
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, strings.TrimRight(e.cfg.ServiceURL, "/")+"/healthz", nil)
	if err != nil {
		return false
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return false
	}
	defer resp.Body.Close()
	return resp.StatusCode >= 200 && resp.StatusCode < 300
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

func (e *Executor) SeedTask(record models.OpenHandsTaskRecord) {
	if e == nil {
		return
	}
	now := time.Now().UTC()
	if strings.TrimSpace(record.ID) == "" {
		record.ID = fmt.Sprintf("mock-openhands-%d", now.UnixNano())
	}
	if strings.TrimSpace(record.Status) == "" {
		if record.Success {
			record.Status = "completed"
		} else {
			record.Status = "failed"
		}
	}
	if record.StartedAt.IsZero() {
		record.StartedAt = now
	}
	if record.FinishedAt.IsZero() {
		record.FinishedAt = record.StartedAt
	}
	if record.DurationMS == 0 && !record.FinishedAt.IsZero() && !record.StartedAt.IsZero() {
		record.DurationMS = record.FinishedAt.Sub(record.StartedAt).Milliseconds()
	}
	if strings.TrimSpace(record.WorkerMode) == "" {
		if strings.TrimSpace(e.cfg.ServiceURL) != "" {
			record.WorkerMode = "service"
		} else {
			record.WorkerMode = "local_runner"
		}
	}
	record.UpdatedAt = now
	e.appendTaskRecord(record)
}
