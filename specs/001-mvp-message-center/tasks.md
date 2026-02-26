# Tasks: EchoCenter MVP

**Input**: Design documents from `/specs/001-mvp-message-center/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 [P] Initialize backend Go module in backend/go.mod
- [X] T002 [P] Install backend dependencies (gin, gin-contrib/cors, modernc.org/sqlite) in backend/
- [X] T003 [P] Initialize frontend React project with Vite and TypeScript in frontend/
- [X] T004 [P] Install frontend dependencies (tailwindcss, postcss, autoprefixer, axios) in frontend/
- [X] T005 [P] Configure Tailwind CSS in frontend/tailwind.config.js and frontend/src/index.css

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure required for all user stories

- [X] T006 Initialize SQLite database and create `messages` table in backend/db.go
- [X] T007 Define Message struct and JSON tags in backend/models.go
- [X] T008 Setup Gin router with basic CORS middleware and logging in backend/main.go
- [X] T009 Create basic error response utility in backend/handlers.go

**Checkpoint**: Foundation ready - backend can start, database is initialized.

---

## Phase 3: User Story 1 - Agent Status Reporting (Priority: P1) 🎯 MVP

**Goal**: Enable agents to send status reports via a standardized API endpoint.

**Independent Test**: Send a JSON payload via curl to `POST /api/messages` and receive a 201 Created response.

### Tests for User Story 1

- [X] T010 [P] [US1] Implement unit tests for message validation logic in backend/handlers_test.go
- [X] T011 [P] [US1] Implement unit tests for database insertion logic in backend/db_test.go

### Implementation for User Story 1

- [X] T012 [P] [US1] Implement CreateMessage database persistence logic in backend/db.go
- [X] T013 [US1] Implement IngestMessage Gin handler with validation in backend/handlers.go
- [X] T014 [US1] Register POST /api/messages route in backend/main.go
- [X] T015 [US1] Verify ingestion endpoint using curl with valid and invalid payloads

**Checkpoint**: User Story 1 functional - agents can now report status.

---

## Phase 4: User Story 2 - Real-time Dashboard Monitoring (Priority: P2)

**Goal**: Display the latest 50 messages in a web dashboard with automatic updates.

**Independent Test**: Open the web dashboard and verify that ingested messages appear in reverse chronological order and update automatically.

### Tests for User Story 2

- [X] T016 [P] [US2] Implement unit tests for GetLatestMessages query logic in backend/db_test.go
- [ ] T017 [P] [US2] Implement unit tests for dashboard polling logic in frontend/src/App.test.tsx (Skipped due to Vitest mocking issues in current env)
- [X] T018 [P] [US2] Implement unit tests for MessageRow visual styling in frontend/src/components/MessageRow.test.tsx

### Implementation for User Story 2

- [X] T019 [P] [US2] Implement GetLatestMessages (limit 50) database query in backend/db.go
- [X] T020 [US2] Implement GetMessages Gin handler in backend/handlers.go
- [X] T021 [US2] Register GET /api/messages route in backend/main.go
- [X] T022 [P] [US2] Create MessageRow component for status display in frontend/src/components/MessageRow.tsx
- [X] T023 [US2] Implement MessageList component with layout in frontend/src/components/MessageList.tsx
- [X] T024 [US2] Implement fetching logic and 2s polling in frontend/src/App.tsx
- [X] T025 [US2] Apply visual styling for INFO, WARNING, and ERROR levels in frontend/src/components/MessageRow.tsx

**Checkpoint**: User Story 2 functional - operators can monitor agents in real-time.

---

## Phase 5: User Story 3 - Message Persistence (Priority: P3)

**Goal**: Ensure all messages are permanently stored and survive system restarts.

**Independent Test**: Ingest a message, stop the backend, restart it, and verify the message is still visible on the dashboard.

### Implementation for User Story 3

- [X] T026 [US3] Verify SQLite database file persistence across restarts in backend/db.go
- [X] T027 [US3] Add index on timestamp column in SQLite schema to optimize retrieval in backend/db.go

**Checkpoint**: User Story 3 functional - data is durable and optimized.

---

## Phase N: Polish & Cross-Cutting Concerns

**Purpose**: Final refinements and documentation

- [X] T028 [P] Update backend/README.md with API documentation
- [X] T029 [P] Final code cleanup and Gin recovery middleware check in backend/main.go
- [X] T030 [P] Run quickstart.md validation steps

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Independent.
- **Foundational (Phase 2)**: Depends on Phase 1.
- **User Story 1 (P1)**: Depends on Phase 2.
- **User Story 2 (P2)**: Depends on User Story 1 (requires data to display).
- **User Story 3 (P3)**: Depends on User Story 1.

### Parallel Opportunities

- T001-T005 (Setup) can run in parallel.
- Test tasks (T010, T011, T016, T017, T018) can run in parallel with their respective implementation setup.
- Frontend component development (T022, T023) can run in parallel with backend handler work.

---

## Implementation Strategy

### MVP First (User Story 1 Only)
1. Complete Setup and Foundational.
2. Complete User Story 1 (Ingestion) along with its backend tests.
3. Verify with curl.

### Incremental Delivery
1. Add User Story 2 (Dashboard) to visualize the ingested data, including frontend tests.
2. Add User Story 3 (Persistence verification and optimization).
3. Perform final polish.
