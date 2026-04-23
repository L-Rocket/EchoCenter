# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]
**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

[Extract from feature spec: primary requirement + technical approach from research]

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: [Go 1.22+, React 19/TypeScript, Python 3.9+, Node 20+, or NEEDS CLARIFICATION]  
**Primary Dependencies**: [Gin, Gorilla WebSocket, Eino, React, Vite, Zustand, Shadcn/ui, Feishu SDK/API, or NEEDS CLARIFICATION]  
**Storage**: [SQLite default, PostgreSQL via DB_DRIVER/DSN/PG_*, browser state, files, or N/A]  
**Testing**: [go test ./..., npm test/lint for selected frontend, Python checks, manual verification, or NEEDS CLARIFICATION]  
**Target Platform**: [EchoCenter backend/frontend local stack, Docker deployment, Feishu long-connection runtime, or NEEDS CLARIFICATION]
**Project Type**: [backend service, frontend workspace, agent integration, docs, cross-stack feature, or NEEDS CLARIFICATION]  
**Performance Goals**: [WebSocket latency/capacity, Butler workflow latency, UI responsiveness, DB query bounds, or NEEDS CLARIFICATION]  
**Constraints**: [JWT/agent-token auth, token-safe output, bounded concurrency, bilingual UI, no raw secret exposure, or NEEDS CLARIFICATION]  
**Scale/Scope**: [affected users, agents, WebSocket clients, integrations, admin workflows, or NEEDS CLARIFICATION]

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Agent Contracts**: Does the plan document changed API, WebSocket, Butler,
  Feishu, or agent message contracts, including compatibility and failure
  responses?
- **Secure Boundaries**: Are authentication, authorization, credential handling,
  token-safe display, and abuse cases explicit for every affected boundary?
- **Real-Time Reliability**: For chat, status, timeline, Feishu, or routing
  changes, are ordering, idempotency, retry/reconnect, timeout, and capacity
  impacts addressed?
- **Observability & Fail-Fast**: Are validation, error propagation, operator logs,
  traces/metrics, and frontend error/loading/disconnected states defined?
- **Pragmatic Verification**: Is the solution scoped to the current need, using
  existing structure and dependencies, with tests or manual verification for
  critical paths and external boundaries?

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
backend/
├── cmd/                 # binaries and tools
├── internal/            # API, auth, Butler, config, models, observability, ops, repository
├── mock_agents/         # Python mock agents and fixtures
├── pkg/                 # shared backend packages
└── scripts/             # local development and mock-stack scripts

frontend/
├── v1/                  # original React/Vite app
├── v2/                  # zero-build HTML prototype
└── v3/                  # current React/Vite design direction

docs/
├── agents/
├── api/
├── architecture/
└── development/
```

**Structure Decision**: [Document the selected structure and reference the real
directories captured above]

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
