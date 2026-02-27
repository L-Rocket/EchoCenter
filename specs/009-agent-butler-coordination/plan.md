# Implementation Plan: Agent Butler Coordination (my-agent)

**Branch**: `009-agent-butler-coordination` | **Date**: 2026-02-25 | **Spec**: `/specs/009-agent-butler-coordination/spec.md`
**Input**: Implement `my-agent` as a Butler using ByteDance's Eino framework with Human-in-the-Loop (HITL) authorization gates.

## Summary
Transform `my-agent` into a system coordinator powered by the Eino framework. The Butler will ingest all system logs and orchestrate commands to other agents. Crucially, all agent-to-agent commands will be intercepted by a mandatory authorization gate, requiring explicit human approval via the UI before execution.

## Technical Context

**Language/Version**: Go 1.22+, TypeScript
**Primary Dependencies**: **ByteDance Eino**, Gorilla WebSocket, Shadcn/ui
**Storage**: SQLite (`butler_authorizations` table)
**Testing**: Unit tests for Eino tool interceptors, integration tests for WebSocket auth frames.
**Target Platform**: Web/Server
**Project Type**: Agent Orchestration
**Constraints**: Zero communication without user approval.

## Constitution Check

1. **Pragmatic Minimalism**: Uses a single dedicated table for auth persistence. (✅ Yes)
2. **Idiomatic Implementation**: Leverages Eino's native graph and tool orchestration. (✅ Yes)
3. **Transparency**: All pending and completed authorizations are logged and visible. (✅ Yes)
4. **Disciplined Iteration**: Split into Eino Foundation -> HITL Gate -> UI Rendering. (✅ Yes)

## Project Structure

### Backend Changes
```text
backend/internal/
├── butler/
│   ├── eino_brain.go    # Eino graph and chain definitions
│   ├── tools.go         # Butler commands (wrapped in HITL)
│   └── service.go       # Singleton Butler lifecycle management
├── websocket/
│   └── handlers.go      # Handle AUTH_RESPONSE frames
```

### Frontend Changes
```text
frontend/src/
├── components/agent/
│   └── AuthRequestCard.tsx # Special UI for Butler approvals
```

## Phases

### Phase 1: Eino Foundation & Ingestion
- Integrate Eino framework into the Go backend.
- Define the Butler's ingestion loop: subscribe to all `SYSTEM_LOG` broadcasts.
- Create placeholder configurations in `.env` for URL and Token.

### Phase 2: The "Authorization Gate" (HITL)
- Create `butler_authorizations` table.
- Implement the Eino `Tool` interceptor that pauses execution and emits `AUTH_REQUEST`.
- Implement `HandleAuthResponse` to resume Eino flow upon user approval.

### Phase 3: Interactive Frontend
- Implement `AuthRequestCard` in the `ChatView`.
- Wire up the WebSocket `AUTH_RESPONSE` transmission.
- Final integration testing of the end-to-end approval loop.
