package observability

import (
	"context"
	"fmt"
	"log"
	"os"
	"strings"
	"sync"

	cozeloopcb "github.com/cloudwego/eino-ext/callbacks/cozeloop"
	"github.com/cloudwego/eino/callbacks"
	"github.com/coze-dev/cozeloop-go"
	"github.com/lea/echocenter/backend/internal/config"
)

type ShutdownFunc func(context.Context)

type Span interface {
	SetTags(ctx context.Context, tagKVs map[string]any)
	SetInput(ctx context.Context, input any)
	SetOutput(ctx context.Context, output any)
	SetError(ctx context.Context, err error)
	SetStatusCode(ctx context.Context, code int)
	SetThreadID(ctx context.Context, threadID string)
	SetServiceName(ctx context.Context, serviceName string)
	SetDeploymentEnv(ctx context.Context, deploymentEnv string)
	Finish(ctx context.Context)
}

type manager struct {
	client        cozeloop.Client
	serviceName   string
	deploymentEnv string
}

var (
	mgrMu sync.RWMutex
	mgr   *manager
)

func Init(cfg config.ObservabilityConfig) (ShutdownFunc, error) {
	if !cfg.CozeLoopEnabled {
		return noopShutdown, nil
	}

	if strings.TrimSpace(os.Getenv("COZELOOP_WORKSPACE_ID")) == "" {
		return nil, fmt.Errorf("COZELOOP_WORKSPACE_ID is required when OBSERVABILITY_COZELOOP_ENABLED=true")
	}
	if strings.TrimSpace(os.Getenv("COZELOOP_API_TOKEN")) == "" {
		return nil, fmt.Errorf("COZELOOP_API_TOKEN is required when OBSERVABILITY_COZELOOP_ENABLED=true")
	}

	client, err := cozeloop.NewClient()
	if err != nil {
		return nil, fmt.Errorf("initialize CozeLoop client: %w", err)
	}

	// Register the official Eino callback once during process startup so
	// model/tool/agent execution paths automatically report to CozeLoop.
	callbacks.AppendGlobalHandlers(cozeloopcb.NewLoopHandler(client))

	mgrMu.Lock()
	mgr = &manager{
		client:        client,
		serviceName:   cfg.ServiceName,
		deploymentEnv: cfg.DeploymentEnv,
	}
	mgrMu.Unlock()

	log.Printf("[Observability] CozeLoop enabled for service %s", cfg.ServiceName)

	return func(ctx context.Context) {
		client.Close(ctx)
	}, nil
}

func StartSpan(ctx context.Context, name, spanType string) (context.Context, Span) {
	mgrMu.RLock()
	current := mgr
	mgrMu.RUnlock()
	if current == nil || current.client == nil {
		return ctx, noopSpan{}
	}

	nextCtx, span := current.client.StartSpan(ctx, name, spanType)
	span.SetServiceName(nextCtx, current.serviceName)
	if current.deploymentEnv != "" {
		span.SetDeploymentEnv(nextCtx, current.deploymentEnv)
	}
	return nextCtx, span
}

func noopShutdown(context.Context) {}

type noopSpan struct{}

func (noopSpan) SetTags(context.Context, map[string]any)  {}
func (noopSpan) SetInput(context.Context, any)            {}
func (noopSpan) SetOutput(context.Context, any)           {}
func (noopSpan) SetError(context.Context, error)          {}
func (noopSpan) SetStatusCode(context.Context, int)       {}
func (noopSpan) SetThreadID(context.Context, string)      {}
func (noopSpan) SetServiceName(context.Context, string)   {}
func (noopSpan) SetDeploymentEnv(context.Context, string) {}
func (noopSpan) Finish(context.Context)                   {}
