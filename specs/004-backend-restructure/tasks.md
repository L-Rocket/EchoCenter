# Tasks: Backend Directory Standardizing

**Input**: Design documents from `/specs/004-backend-restructure/`
**Prerequisites**: plan.md, spec.md, research.md

**Organization**: Tasks are grouped by implementation phase to ensure a stable refactoring process.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize the standard Go project structure.

- [X] T001 Create directory structure: `cmd/server`, `internal/auth`, `internal/database`, `internal/handlers`, `internal/models` in `/Users/lea/prj/EchoCenter/backend/`

---

## Phase 2: Foundational (Models & Auth Migration)

**Purpose**: Migrate shared data structures and authentication logic to internal packages.

- [X] T002 Move `/Users/lea/prj/EchoCenter/backend/models.go` to `/Users/lea/prj/EchoCenter/backend/internal/models/models.go` and update package declaration
- [X] T003 Move files from `/Users/lea/prj/EchoCenter/backend/auth/` to `/Users/lea/prj/EchoCenter/backend/internal/auth/` and update package declarations
- [X] T004 [P] Update internal imports in `/Users/lea/prj/EchoCenter/backend/internal/auth/` to use `github.com/lea/echocenter/backend/internal/models`
- [X] T005 [P] Migrate auth unit tests (`*_test.go`) to `/Users/lea/prj/EchoCenter/backend/internal/auth/`

**Checkpoint**: Models and Auth migrated - packages should compile individually.

---

## Phase 3: User Story 1 - Standardized Project Layout (Logic Migration) 🎯 MVP

**Goal**: Move database and handler logic into the `internal/` package structure.

**Independent Test**: Ensure `internal/database` and `internal/handlers` compile and pass their respective unit tests.

### Implementation for User Story 1

- [X] T006 [US1] Move `/Users/lea/prj/EchoCenter/backend/db.go` to `/Users/lea/prj/EchoCenter/backend/internal/database/database.go` and update package declaration
- [X] T007 [US1] Move `/Users/lea/prj/EchoCenter/backend/db_test.go` to `/Users/lea/prj/EchoCenter/backend/internal/database/database_test.go` and update package declaration
- [X] T008 [US1] Update imports in `/Users/lea/prj/EchoCenter/backend/internal/database/database.go` to reference `internal/models`
- [X] T009 [US1] Move `/Users/lea/prj/EchoCenter/backend/handlers.go` to `/Users/lea/prj/EchoCenter/backend/internal/handlers/handlers.go` and update package declaration
- [X] T010 [US1] Move `/Users/lea/prj/EchoCenter/backend/handlers_test.go` to `/Users/lea/prj/EchoCenter/backend/internal/handlers/handlers_test.go` and update package declaration
- [X] T011 [US1] Update imports in `/Users/lea/prj/EchoCenter/backend/internal/handlers/handlers.go` to reference `internal/auth`, `internal/database`, and `internal/models`

**Checkpoint**: Business logic migrated - all core sub-packages are now standard Go packages.

---

## Phase 4: User Story 1 - Standardized Project Layout (Entry Point)

**Goal**: Relocate the main entry point and update final wiring.

**Independent Test**: Build and run the server from `cmd/server/main.go` and verify basic functionality.

### Implementation for User Story 1 (continued)

- [X] T012 [US1] Move `/Users/lea/prj/EchoCenter/backend/main.go` to `/Users/lea/prj/EchoCenter/backend/cmd/server/main.go`
- [X] T013 [US1] Update imports in `/Users/lea/prj/EchoCenter/backend/cmd/server/main.go` to use the new `internal/` package paths
- [X] T014 [US1] Verify `.env` and SQLite database path resolution in `/Users/lea/prj/EchoCenter/backend/cmd/server/main.go`

---

## Phase N: Polish & Cross-Cutting Concerns

**Purpose**: Final verification and cleanup.

- [X] T015 Run `go mod tidy` in `/Users/lea/prj/EchoCenter/backend/` to clean up module dependencies
- [X] T016 [P] Run all backend tests: `go test ./internal/...` from backend root
- [X] T017 [P] Verify binary build: `go build -o server ./cmd/server` from backend root
- [X] T018 Perform manual integration verification (Login + Message Retrieval) via `curl`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Independent.
- **Foundational (Phase 2)**: Depends on Phase 1 (Directories).
- **User Story 1 (Phases 3 & 4)**: Depends on Phase 2 (Models are used everywhere).
- **Polish (Phase N)**: Depends on all previous phases.

### Parallel Opportunities

- T004 and T005 (Auth imports and tests) can run in parallel.
- Database migration (T006-T008) and Handlers migration (T009-T011) can run in parallel if models/auth are ready.
- Polish verification tasks (T016, T017) can run in parallel.

---

## Implementation Strategy

### MVP First (Complete Refactor)
1. Initialize structure.
2. Migrate dependency-free packages (Models).
3. Migrate logic packages (Auth, DB, Handlers).
4. Relocate Entry Point.
5. **STOP and VALIDATE**: Full test suite pass and build check.

---

## Notes

- All internal package paths must use the prefix: `github.com/lea/echocenter/backend/internal/`
- Ensure no circular dependencies are introduced (Models must remain standalone).
- The execution root for the binary should remain the `backend/` directory to ensure `.env` and `echocenter.db` paths remain valid.
