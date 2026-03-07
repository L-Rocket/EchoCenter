# Implementation Plan: Chat History Persistence

**Branch**: `007-chat-history-persistence` | **Date**: 2026-02-25 | **Spec**: `/specs/007-chat-history-persistence/spec.md`
**Input**: Feature specification for persisting bi-directional WebSocket chat messages.

## Summary
Implement a persistent storage layer for chat messages in EchoCenter. This involves creating a new database table, modifying the WebSocket Hub to record messages, and providing a REST API for the frontend to retrieve history upon selecting an agent.

## Technical Context

**Language/Version**: Go 1.22+, TypeScript
**Primary Dependencies**: Gorilla WebSocket, Gin, Zustand
**Storage**: Relational database (`chat_messages` table)
**Testing**: `go test` for repository logic, Vitest for store merging logic.
**Target Platform**: Web
**Project Type**: Feature Expansion (Persistence)
**Performance Goals**: <300ms load time for last 50 messages.
**Constraints**: strictly limited to `CHAT` type messages; `SYSTEM_LOG` remains outside this table.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

1. **Pragmatic Minimalism**: Does this use existing DB structure? (✅ Yes, adds one focused table to the existing database).
2. **Idiomatic Implementation**: Follows standard repository patterns for persistence. (✅ Yes)
3. **Transparency**: Clear error handling for failed DB writes during WS broadcast. (✅ Yes)
4. **Disciplined Iteration**: Split into schema setup -> backend hook -> frontend load. (✅ Yes)
5. **Practical Testing**: Critical path (write-broadcast-read) is testable. (✅ Yes)

## Project Structure

### Backend Changes
```text
backend/internal/
├── database/
│   └── chat_repository.go  # Chat-specific DB operations
├── websocket/
│   └── hub.go              # Modified to trigger async writes
├── handlers/
│   └── chat_handlers.go    # History retrieval API
```

### Frontend Changes
```text
frontend/src/
├── store/
│   └── useChatStore.ts     # Enhanced to handle history hydration
├── components/agent/
│   └── ChatView.tsx        # Modified to trigger fetch on mount
```

## Phases

### Phase 0: Outline & Research
- Define async writing strategy to ensure WebSocket performance isn't blocked by DB I/O.
- Research de-duplication strategies for merging historical data with real-time arrivals.

### Phase 1: Schema & API
- Create `chat_messages` table.
- Implement `GET /api/chat/history/:peer_id` with 50-message limit.
- Unit test history retrieval.

### Phase 2: Persistence Hook
- Update WebSocket Hub to save messages of type `CHAT` to the database.
- Ensure sender/receiver IDs are correctly mapped from the token context.

### Phase 3: Frontend Hydration
- Update `useChatStore` to support a `setHistory` action.
- Update `ChatView` to fetch history on mount/agent-change.
- Verify de-duplication during high-frequency message arrival.
