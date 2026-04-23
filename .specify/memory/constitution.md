<!--
SYNC IMPACT REPORT
Version change: 1.2.0 -> 2.0.0
Modified principles:
- Established: I. Agent Contracts Are Product Contracts
- Established: II. Secure Boundaries By Default
- Established: III. Real-Time Reliability Is Core Behavior
- Established: IV. Observable And Fail-Fast Operations
- Established: V. Pragmatic, Verifiable Iteration
Added sections:
- Architectural Constraints
- Workflow Integrity
Removed sections: None
Templates requiring updates:
- .specify/templates/plan-template.md (✅ updated)
- .specify/templates/spec-template.md (✅ updated)
- .specify/templates/tasks-template.md (✅ updated)
- .specify/templates/commands/*.md (✅ validated; directory not present)
Follow-up TODOs: None
-->

# EchoCenter Constitution

## Core Principles

### I. Agent Contracts Are Product Contracts
EchoCenter exists to coordinate human users, Butler, external agents, and
integrations through explicit contracts. Every feature that changes agent
registration, command execution, WebSocket payloads, Feishu routing, approval
cards, or Butler workflow state MUST document the affected contract and preserve
backward compatibility unless the breaking change is intentionally versioned.

Feature specs MUST define the actors, message/event shapes, state transitions,
and failure responses for every changed workflow. Implementations MUST keep
agent-facing behavior deterministic and discoverable through API, WebSocket, or
integration documentation.

Rationale: Agent ecosystems fail when implicit behavior drifts. The protocol is
part of the product surface, not an implementation detail.

### II. Secure Boundaries By Default
Authentication, authorization, credential handling, and tenant-like agent
isolation are mandatory design concerns. New backend and integration behavior
MUST enforce JWT or agent-token authorization at the boundary, validate inputs
before side effects, and avoid exposing raw secrets in API responses, logs,
frontend state, screenshots, or generated fixtures.

Features that touch tokens, Feishu credentials, Butler model keys, CozeLoop
credentials, admin settings, or command execution MUST include abuse cases and
explicit authorization checks in the plan. Token-safe representations such as
`token_hint` are preferred for display and diagnostics.

Rationale: EchoCenter can execute commands and relay messages across agents and
external services, so weak boundaries become system-wide risk.

### III. Real-Time Reliability Is Core Behavior
WebSocket and long-connection behavior MUST be treated as primary product
functionality. Features that affect chat, agent status, timeline monitoring,
Feishu long-connection ingress, or Butler-to-agent routing MUST define ordering,
idempotency, retry/reconnect behavior, timeout behavior, and user-visible
failure states.

Implementations SHOULD prefer simple, bounded concurrency models and explicit
backpressure over unbounded goroutines, queues, or client-side retries. Any
change that can affect connection capacity, memory growth, or message latency
MUST include a verification plan appropriate to the risk.

Rationale: EchoCenter's value depends on reliable bidirectional coordination.
Silent message loss or ambiguous connection state is a correctness bug.

### IV. Observable And Fail-Fast Operations
Failures MUST be returned or logged with enough context to answer what failed,
which actor or integration was involved, and what recovery path exists. Code
MUST NOT swallow errors or continue after invalid state, malformed payloads, or
failed authorization checks.

Backend features MUST add structured logs, traces, or metrics at external
boundaries and workflow transitions where operators would otherwise need a
debugger. Frontend features MUST present actionable error, loading, empty, and
disconnected states for admin and chat workflows.

Rationale: Multi-agent orchestration crosses process and service boundaries.
Clear failure signals are the only practical way to operate and debug it.

### V. Pragmatic, Verifiable Iteration
Solutions MUST be as small as the current requirement allows while remaining
testable and maintainable. Do not introduce generic frameworks, repository
layers, background workers, adapters, or shared abstractions for a single use
case unless they remove concrete complexity or match an established local
pattern.

Each feature MUST ship as independently verifiable user-story increments.
Critical paths, complex state transitions, external boundaries, and security
checks MUST have tests or an explicit manual verification record. Refactors are
acceptable only when they reduce risk for the current change and are scoped to
the affected domain.

Rationale: EchoCenter combines backend, frontend, agents, and integrations.
Small verified changes keep the system stable while it evolves.

## Architectural Constraints

EchoCenter is a Go backend, React/TypeScript frontend, Python agent, and
documentation site project. Plans MUST use the existing structure unless they
justify a change:

- Backend code belongs under `backend/internal`, `backend/pkg`, `backend/cmd`,
  or `backend/scripts` according to the current ownership pattern.
- Frontend product work belongs under the selected `frontend/v*` app and MUST
  preserve the bilingual admin and chat experience when it changes visible UI.
- Agent examples and mock agents belong under `backend/mock_agents` unless a
  separate runtime boundary is required.
- Product and integration documentation belongs under `docs/` and MUST be
  updated when public behavior, setup, APIs, WebSocket events, or Feishu flows
  change.

Dependencies MUST be justified by the problem they solve, maintenance activity,
security footprint, and fit with the current stack. Prefer Go standard library
facilities, established project dependencies, and small local code before adding
new packages.

## Workflow Integrity

Every implementation plan MUST complete the Constitution Check before research
and repeat it after design. Deviations from this constitution MUST be listed in
Complexity Tracking with the simpler alternative considered and the reason it
was rejected.

Tasks MUST be grouped into independently testable user-story increments and
include verification work for security boundaries, real-time behavior,
observability, and regression risk when those areas are touched. Commits SHOULD
remain focused on one logical change, and generated specs/plans/tasks MUST stay
consistent with the current codebase rather than template examples.

## Governance

This Constitution is the definition of quality for EchoCenter and supersedes
conflicting generated guidance. Code reviews, implementation plans, and task
lists MUST verify compliance with the principles above.

Amendments require a Sync Impact Report, an explicit semantic version change,
and validation of dependent templates. Use MAJOR for incompatible governance or
principle redefinitions, MINOR for added or materially expanded guidance, and
PATCH for clarifications that do not change obligations.

Ratification date records the first adoption of this constitution. Last amended
date MUST change whenever constitution content changes.

**Version**: 2.0.0 | **Ratified**: 2026-02-25 | **Last Amended**: 2026-04-23
