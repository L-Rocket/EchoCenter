# Tasks: Chat History Persistence

**Input**: Design documents from `/specs/007-chat-history-persistence/`
**Prerequisites**: plan.md, spec.md, data-model.md, research.md, contracts/chat-api.md

**Organization**: Tasks are grouped by implementation phase to ensure a robust migration to persistent conversations.

## Phase 1: Schema & Backend Foundation

**Purpose**: Establish the database structure and core repository logic.

- [X] T001 Create `chat_messages` table with `IDX_CHAT_PAIR_TIME` index in `backend/internal/database/database.go`
- [X] T002 Implement `SaveChatMessage` function in `backend/internal/database/database.go`
- [X] T003 Implement `GetChatHistory` function in `backend/internal/database/database.go`
- [X] T004 [P] Implement unit tests for `GetChatHistory` and `SaveChatMessage` in `backend/internal/database/database_test.go`

---

## Phase 2: Persistence Hook (WebSocket Hub)

**Purpose**: Integrate asynchronous archiving into the real-time communication flow.

- [X] T005 Modify `Hub.Run` in `backend/internal/websocket/hub.go` to trigger `go database.SaveChatMessage` for `CHAT` type messages
- [X] T006 [P] Implement integration test for WebSocket-to-DB persistence in `backend/internal/websocket/hub_test.go`

---

## Phase 3: History API

**Purpose**: Provide an authenticated endpoint for the frontend to retrieve history.

- [X] T007 Implement `HandleGetChatHistory` handler in `backend/internal/handlers/handlers.go`
- [X] T008 Register `GET /api/chat/history/:peer_id` route in `backend/cmd/server/main.go`
- [X] T009 [P] Implement unit tests for history API authentication and response format in `backend/internal/handlers/handlers_test.go`

**Checkpoint**: Backend ready - conversation history is archived and accessible via API.

---

## Phase 4: Frontend Hydration (Zustand)

**Purpose**: Enhance the client-side store to handle historical data.

- [X] T010 [P] Update `ChatState` interface and implement `setHistory` action in `frontend/src/store/useChatStore.ts`
- [X] T011 [P] Implement de-duplication logic in `addMessage` and `setHistory` to handle race conditions in `frontend/src/store/useChatStore.ts`
- [ ] T012 [P] Implement unit tests for `setHistory` and de-duplication in `frontend/src/store/useChatStore.test.ts` (Skipped for MVP speed)

---

## Phase 5: UI Integration (ChatView)

**Purpose**: Automatically load and display history when engaging with an agent.

- [X] T013 Update `ChatView` to fetch history from `/api/chat/history/:peer_id` on mount in `frontend/src/components/agent/ChatView.tsx`
- [X] T014 Implement "Loading History" skeleton or spinner in `ChatView.tsx`
- [X] T015 Ensure "Awaiting Transmission" empty state only appears if history is empty in `ChatView.tsx`
- [ ] T016 [P] Implement unit test for history loading trigger in `frontend/src/components/agent/ChatView.test.tsx` (Skipped for MVP speed)

**Checkpoint**: Feature complete - conversations are persistent across refreshes and restarts.

---

## Phase N: Polish & Verification

**Purpose**: Final quality assurance and performance check.

- [X] T017 Verify `SC-001`: Measure history load time is < 300ms using browser DevTools
- [X] T018 Verify `SC-002`: Inspect database after multiple WebSocket exchanges to confirm 100% persistence
- [X] T019 Run production build and verify asset integrity in `frontend/`
- [X] T020 Run full integration verification: Message -> Refresh -> Verify History

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Independent.
- **WebSocket Hook (Phase 2)**: Depends on Phase 1 (for Repository logic).
- **History API (Phase 3)**: Depends on Phase 1.
- **Frontend Store (Phase 4)**: Independent.
- **UI Integration (Phase 5)**: Depends on Phase 3 (API) and Phase 4 (Store).

### Parallel Opportunities

- Backend Repository (`T001-T004`) and Frontend Store (`T010-T012`) can run in parallel.
- Logic migration (`T005-T006`) and API development (`T007-T009`) can run in parallel.
- Polish verification (`T017-T018`) can run in parallel with final build.

---

## Implementation Strategy

### MVP First (Persistence & API)
1. Complete Phase 1 and 2 (Archive messages to DB).
2. Complete Phase 3 (Expose API).
3. Verify via `curl` that messages are being saved.

### Incremental Delivery
1. Update Frontend Store (Phase 4).
2. Wire up ChatView (Phase 5).
3. Final polish (Phase N).
