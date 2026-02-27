# Tasks: Agent Butler Coordination (my-agent)

**Input**: Design documents from `/specs/009-agent-butler-coordination/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ws-api.md

**Organization**: Tasks are ordered to build the Butler's intelligence foundation first, followed by the safety-critical authorization gate and finally the interactive UI.

## Phase 1: Setup & Eino Infrastructure

**Purpose**: Initialize the orchestration framework and project structure.

- [X] T001 [P] Install Eino framework dependencies in `backend/go.mod`
- [X] T002 Create directory structure for Butler logic: `backend/internal/butler/`
- [X] T003 Add `BUTLER_BASE_URL` and `BUTLER_API_TOKEN` placeholders to `backend/.env.example`

---

## Phase 2: Foundational (Orchestration & Data)

**Purpose**: Establish the core Butler lifecycle and persistence.

- [X] T004 Create `butler_authorizations` table in `backend/internal/database/database.go` per data model
- [X] T005 Implement `SaveAuthorization` and `UpdateAuthorizationStatus` in `backend/internal/database/database.go`
- [X] T006 Implement Butler singleton initialization and lifecycle management in `backend/internal/butler/service.go`
- [X] T007 [P] Implement unit tests for authorization persistence in `backend/internal/database/database_test.go`

---

## Phase 3: US1 - Centralized Butler Visibility (Priority: P1)

**Goal**: Butler receives system-wide status updates for situational awareness.

- [X] T008 [US1] Create Eino ingestion chain/graph in `backend/internal/butler/eino_brain.go` to process log inputs
- [X] T009 [US1] Connect `websocket.Hub` broadcast loop to trigger Butler ingestion in `backend/internal/websocket/hub.go`
- [X] T010 [P] [US1] Implement unit tests for Butler log ingestion logic in `backend/internal/butler/eino_brain_test.go`

---

## Phase 4: US2 - Command Gate (HITL) (Priority: P1) 🎯 MVP

**Goal**: Implement the physical barrier for Butler-to-Agent communication.

- [X] T011 [US2] Implement `CommandAgent` Eino Tool in `backend/internal/butler/tools.go`
- [X] T012 [US2] Implement the HITL Interceptor in `backend/internal/butler/tools.go` that blocks execution and saves a `PENDING` request
- [X] T013 [US2] Implement logic to emit `AUTH_REQUEST` WebSocket frames to connected operators in `backend/internal/websocket/hub.go`
- [X] T014 [US2] Implement `HandleAuthResponse` in `backend/internal/handlers/handlers.go` to resume Eino tool execution upon approval
- [X] T015 [P] [US2] Implement integration test for the HITL "Propose -> Wait -> Resume" loop in `backend/internal/butler/service_test.go`

**Checkpoint**: Backend safety ready - Butler cannot command agents without generating a request.

---

## Phase 5: US3 - Interactive Authorization UI (Priority: P2)

**Goal**: Render actionable approval cards in the chat interface.

- [X] T016 [US3] Create `AuthRequestCard.tsx` component in `frontend/src/components/agent/AuthRequestCard.tsx` using Shadcn `Card` and `Button`
- [X] T017 [US3] Update `ChatView.tsx` to identify and render `AUTH_REQUEST` type messages using the new card component
- [X] T018 [US3] Implement WebSocket transmission for `AUTH_RESPONSE` (Approve/Reject) in `frontend/src/context/AuthContext.tsx`

---

## Phase N: Polish & Verification

**Purpose**: Final verification and reliability checks.

- [X] T019 Verify `SC-004`: Ensure pending authorizations are recovered correctly after server restart in `ChatView.tsx`
- [X] T020 Run full end-to-end integration: Ingest Error -> Butler Proposes Action -> User Approves -> Action Executed

---

## Dependencies & Execution Order

### Phase Dependencies

- **Infrastructure (Phase 1)**: Independent.
- **Foundation (Phase 2)**: Depends on Phase 1.
- **Visibility (Phase 3)**: Depends on Phase 2.
- **Command Gate (Phase 4)**: Depends on Phase 2 and 3.
- **Frontend UI (Phase 5)**: Depends on Phase 4 (for protocol support).

### Parallel Opportunities

- Persistence implementation (`T004-T005`) and Eino graph design (`T008`) can run in parallel.
- Frontend component development (`T016`) can start as soon as the WebSocket contract is finalized.

---

## Implementation Strategy

### MVP First (Safety First)
1. Complete Infrastructure and Foundation.
2. Implement US1 (Visibility).
3. Implement US2 (The Gate) with simple server-side logging.
4. **STOP and VALIDATE**: Ensure Butler is physically blocked from sending commands.

### Incremental Delivery
1. Add the Frontend Authorization UI (US3).
2. Add complex reasoning/logic to the Eino brain.
3. Final polish and state recovery.
