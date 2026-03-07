# Implementation Plan: Agent Chat Integration

**Branch**: `005-agent-chat-integration` | **Date**: 2026-02-25 | **Spec**: `/specs/005-agent-chat-integration/spec.md`
**Input**: Implement bi-directional chat between users and agents using WebSockets and Shadcn/ui.

## Summary
Extend EchoCenter to support a new "Agent" entity and bi-directional real-time chat. The backend will implement a WebSocket hub to route messages between human users and agents authenticated via static tokens. The frontend will feature a new sidebar-driven Agent navigation and a dedicated chat interface using consistent design primitives.

## Technical Context

**Language/Version**: Go 1.22+, TypeScript
**Primary Dependencies**: `github.com/gorilla/websocket` (Backend), `shadcn/ui`, `lucide-react`, `zustand` (Frontend state)
**Storage**: Relational database (Agent registration), In-memory (Volatile chat history)
**Testing**: `go test` for WS hub logic, Vitest for chat components.
**Target Platform**: Web
**Project Type**: Feature Expansion (WebSockets + UI Refactor)
**Performance Goals**: WS connection < 500ms, message delivery < 200ms.
**Constraints**: strictly volatile chat history (no DB persistence for chat messages).

## Constitution Check

1. **Pragmatic Minimalism**: Does WebSockets add too much complexity? (✅ No, essential for real-time chat functionality).
2. **Idiomatic Implementation**: Follows standard Go `internal/` structure and React patterns. (✅ Yes)
3. **Transparency**: Explicit handling of WS connection states and errors. (✅ Yes)
4. **Disciplined Iteration**: Split into discrete phases (Backend Auth -> WS Hub -> UI Integration). (✅ Yes)

## Project Structure

### Backend Changes
```text
backend/internal/
├── auth/
│   └── token_provider.go   # Logic for Agent token validation
├── websocket/
│   ├── hub.go              # WS connection management and routing
│   └── client.go           # Individual WS connection handler
├── handlers/
│   ├── agent_handlers.go   # CRUD for Agent entities (Admin only)
│   └── ws_handler.go       # Entry point for WS upgrades
```

### Frontend Changes
```text
frontend/src/
├── components/
│   ├── agent/
│   │   ├── AgentList.tsx   # Sidebar/Dashboard widget
│   │   └── ChatDialog.tsx  # Bi-directional chat UI
│   └── ui/                 # Shadcn primitives (ScrollArea, etc.)
├── store/
│   └── useChatStore.ts     # Volatile message storage (Zustand)
├── hooks/
│   └── useWebSocket.ts     # WS lifecycle management
```

## Phases

### Phase 1: Agent Management & Token Auth
- Implement `AGENT` role in `internal/models`.
- Create migration for `agents` table or extend `users` with `api_token`.
- Implement Admin-only API to generate Agent tokens.

### Phase 2: WebSocket Core (Backend)
- Implement WebSocket Hub for message broadcasting/routing.
- Implement token-based authentication for WS handshake.
- Unit test hub logic (message routing between user and agent).

### Phase 3: Chat UI & WebSocket Integration (Frontend)
- Implement `ChatDialog` using Shadcn `ScrollArea` and `Card`.
- Implement `useWebSocket` hook for real-time connectivity.
- Integrate "Agent" navigation into Sidebar and Dashboard.
- Final visual polish and responsive testing.
