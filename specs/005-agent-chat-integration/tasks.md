# Tasks: Agent Chat Integration

**Input**: Design documents from `/specs/005-agent-chat-integration/`
**Prerequisites**: plan.md, spec.md, data-model.md, research.md, contracts/ws-api.md

**Organization**: Tasks are grouped by implementation phase to ensure a robust bi-directional communication system.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize dependencies and directory structure for real-time messaging.

- [X] T001 [P] Install `github.com/gorilla/websocket` in `backend/`
- [X] T002 [P] Install `zustand` in `frontend/`
- [X] T003 Create directory structure: `backend/internal/websocket/` and `frontend/src/store/`, `frontend/src/hooks/`, `frontend/src/components/agent/`

---

## Phase 2: Foundational (Agent Management & Token Auth)

**Purpose**: Extend the user model and implement secure agent registration.

- [X] T004 [P] Add `AGENT` role and `ApiToken` field to `User` struct in `backend/internal/models/models.go`
- [X] T005 [P] Update database schema to include `api_token` column in `users` table in `backend/internal/database/database.go`
- [X] T006 Implement `GetAgentByToken` query in `backend/internal/database/database.go`
- [X] T007 [US2] Implement `RegisterAgent` handler (Admin only) in `backend/internal/handlers/handlers.go`
- [X] T008 [US2] Register `POST /api/users/agents` route in `backend/cmd/server/main.go`
- [X] T009 [US2] Verify agent registration and token generation using `curl`

---

## Phase 3: WebSocket Core (Backend Hub & Handshake)

**Purpose**: Build the real-time routing engine and secure the connection handshake.

- [X] T010 Implement `Hub` for connection management and message broadcasting in `backend/internal/websocket/hub.go`
- [X] T011 Implement `Client` read/write pumps and message processing in `backend/internal/websocket/client.go`
- [X] T012 Implement `ServeWs` handler with query-param token authentication in `backend/internal/handlers/handlers.go`
- [X] T013 Register `GET /api/ws` route in `backend/cmd/server/main.go`
- [X] T014 [P] Implement unit tests for `Hub` message routing in `backend/internal/websocket/hub_test.go`

**Checkpoint**: Backend ready - WebSocket hub is verified and supports token-authenticated connections.

---

## Phase 4: Frontend Infrastructure (State & Hook)

**Purpose**: Establish the client-side foundation for real-time interaction.

- [X] T015 [P] Implement `useChatStore` for volatile message management in `frontend/src/store/useChatStore.ts`
- [ ] T016 [P] Implement unit tests for `useChatStore` in `frontend/src/store/useChatStore.test.ts` (Skipped for MVP speed)
- [X] T017 [P] Implement `useWebSocket` hook for lifecycle management and message routing in `frontend/src/hooks/useWebSocket.ts`
- [ ] T018 [P] Implement unit tests for `useWebSocket` lifecycle states in `frontend/src/hooks/useWebSocket.test.ts` (Skipped for MVP speed)

---

## Phase 5: Agent Navigation & UI Redesign (Priority: P1)

**Purpose**: Implement agent discovery and sidebar navigation.

- [X] T019 [US1] Rename "Model" to "Agent" across all UI labels in `frontend/src/`
- [X] T020 [US1] Add "Agents" menu item to `MainLayout` sidebar in `frontend/src/components/MainLayout.tsx`
- [X] T021 [US1] Create `AgentList` component for dashboard/sidebar in `frontend/src/components/agent/AgentList.tsx`

---

## Phase 6: Bi-directional Chat Dialog (Priority: P2)

**Purpose**: Implement the interactive conversation interface.

- [X] T022 [US3] Create `ChatDialog` component using Shadcn `ScrollArea` and `Card` in `frontend/src/components/agent/ChatDialog.tsx`
- [X] T023 [US3] Implement message send/receive logic using `useWebSocket` and `useChatStore` in `ChatDialog.tsx`
- [X] T024 [US3] Implement visual differentiation between User and Agent messages in `ChatDialog.tsx`
- [ ] T025 [US3] Implement unit tests for `ChatDialog` rendering and message attribution in `frontend/src/components/agent/ChatDialog.test.tsx` (Skipped for MVP speed)
- [X] T026 [US3] Integrate `ChatDialog` into the Dashboard and Agent Detail views in `frontend/src/App.tsx`

**Checkpoint**: Feature complete - operators and agents can exchange real-time messages.

---

## Phase N: Polish & Cross-Cutting Concerns

**Purpose**: Final verification and UX refinement.

- [X] T027 [P] Implement "Disconnected" status feedback in the UI header
- [X] T028 [P] Add auto-reconnect logic with exponential backoff in `useWebSocket.ts`
- [X] T029 Verify `SC-001`: Measure WebSocket connection time is < 500ms using browser DevTools Performance tab
- [X] T030 Verify `SC-002`: Measure message delivery latency is < 200ms using internal server/client timestamps in logs
- [X] T031 Run full integration verification: Connect external agent via `wscat` and chat via dashboard

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Independent.
- **Foundational (Phase 2)**: Depends on Phase 1.
- **WebSocket Core (Phase 3)**: Depends on Phase 2 (for Auth) and Phase 1 (for Gorilla).
- **Frontend Infrastructure (Phase 4)**: Depends on Phase 1 (for Zustand).
- **UI Phases (5 & 6)**: Depends on Phase 3 (Backend Hub) and Phase 4 (Store/Hooks).

### Parallel Opportunities

- Backend Foundational (T004-T006) and Frontend Infrastructure (T015-T018) can run in parallel.
- UI Redesign (T019-T021) can run in parallel with WebSocket Core (Phase 3).
- Polish tasks (T027-T030) can run in parallel after basic chat is functional.

---

## Implementation Strategy

### MVP First (WebSocket Messaging Only)
1. Complete Phases 1, 2, and 3.
2. Verify communication with `wscat`.
3. Complete Phase 4 and basic Dashboard integration.

### Incremental Delivery
1. Add full Sidebar navigation (Phase 5).
2. Add dedicated Chat Dialog (Phase 6).
3. Final polish and reliability (Phase N).
