# Feature Specification: Backend Directory Standardizing

**Feature Branch**: `004-backend-restructure`  
**Created**: 2026-02-25  
**Status**: Draft  
**Input**: User description: "后端文件目录太乱了，我想整理一下，标准化一下这个文件夹，以便后续添加功能"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Standardized Project Layout (Priority: P1)

As a developer, I want to follow the standard Go project layout (using `cmd/` and `internal/`) so that the project structure is predictable, maintainable, and scalable for future feature additions.

**Why this priority**: Essential for long-term project health. Prevents the root directory from becoming a "dumping ground" for all logic.

**Independent Test**: Can be tested by verifying the existence of the new directory structure and ensuring the application builds and runs exactly as before.

**Acceptance Scenarios**:

1. **Given** the current flat backend structure, **When** I reorganize files into `cmd/` and `internal/` packages, **Then** all internal imports are updated and the project compiles without errors.
2. **Given** the new structure, **When** I run existing unit tests, **Then** 100% of tests pass.
3. **Given** the new structure, **When** I perform a manual login and message retrieval check, **Then** the system behaves identically to the previous version.

---

### Edge Cases

- **Circular Dependencies**: Moving files into sub-packages might reveal or create circular dependencies (e.g., models needing db, db needing models).
- **Environment Variable Loading**: Ensuring `godotenv` still finds the `.env` file correctly after moving `main.go`.
- **Test File Paths**: Ensuring tests still find test database files or mock data.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST move the main entry point to `backend/cmd/server/main.go`.
- **FR-002**: System MUST move domain entities/structs to `backend/internal/models/`.
- **FR-003**: System MUST move database initialization and operations to `backend/internal/database/`.
- **FR-004**: System MUST move HTTP handlers and route registration to `backend/internal/handlers/`.
- **FR-005**: System MUST move authentication logic and middleware to `backend/internal/auth/`.
- **FR-006**: System MUST update all internal package imports to reflect the new paths relative to the module name.
- **FR-007**: System MUST ensure that the SQLite database path remains relative to the project root or is correctly handled in the new location.

### Key Entities *(include if feature involves data)*

- **Backend Directory Tree**:
    - `cmd/server/`: Entry point.
    - `internal/auth/`: JWT and Hashing logic.
    - `internal/database/`: SQLite operations.
    - `internal/handlers/`: Gin route handlers.
    - `internal/models/`: Shared data structures.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Backend binary compiles successfully using `go build ./cmd/server`.
- **SC-002**: 100% of existing unit tests pass using `go test ./internal/...`.
- **SC-003**: Integration verification: A `curl` login request and a `curl` message retrieval request both return 200 OK using the new binary.
- **SC-004**: No circular dependencies are introduced during the refactoring process.

## Assumptions

- **A-001**: The Go module name is `github.com/lea/echocenter/backend`.
- **A-002**: Refactoring is limited to directory structure and import updates; no new business logic or UI changes are included.
- **A-003**: The `.env` file remains at the `backend/` root and is correctly located by the binary.
