# Tasks: User Login

**Input**: Design documents from `/specs/002-user-login/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 [P] Install backend authentication dependencies (jwt, bcrypt, godotenv) in backend/
- [X] T002 [P] Install frontend authentication dependencies (jwt-decode, react-router-dom) in frontend/
- [X] T003 Create `.env.example` with auth placeholders in backend/.env.example

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core user and authentication logic required for all user stories

- [X] T004 Create `users` table in backend/db.go
- [X] T005 Implement User model and Login structs in backend/models.go
- [X] T006 Implement JWT signing and verification utilities in backend/auth/jwt.go
- [X] T007 [P] Implement unit tests for JWT signing/verification in backend/auth/jwt_test.go
- [X] T008 [P] Implement unit tests for password hashing/comparison in backend/auth/hash_test.go
- [X] T009 Implement Admin initialization from environment variables in backend/db.go
- [X] T010 Implement Auth Middleware for JWT validation in backend/auth/middleware.go
- [X] T011 [P] Implement unit tests for Auth Middleware in backend/auth/middleware_test.go

**Checkpoint**: Foundation ready - backend can handle user storage, verified token logic, and middleware.

---

## Phase 3: User Story 1 - Admin Authentication (Priority: P1) 🎯 MVP

**Goal**: Enable system operators to log in using pre-configured admin credentials.

**Independent Test**: Use `curl` to login with `INITIAL_ADMIN_USER` and receive a valid JWT.

### Implementation for User Story 1

- [X] T012 [P] [US1] Implement `GetUserByUsername` logic in backend/db.go
- [X] T013 [US1] Implement `Login` handler logic in backend/handlers.go
- [X] T014 [US1] Register `POST /api/auth/login` route in backend/main.go
- [X] T015 [US1] Apply Auth Middleware to `POST /api/messages` and `GET /api/messages` in backend/main.go
- [X] T016 [US1] Verify login and protected access using `curl`
- [X] T017 [US1] Verify SC-002: Measure login process completes in under 1 second using time-stamped curl or script

**Checkpoint**: User Story 1 functional - basic security gate is active and performance verified.

---

## Phase 4: User Story 2 - User Management & Session Persistence (Priority: P2)

**Goal**: Support admin-led user creation and persistent login state on frontend.

**Independent Test**: Login via UI, create a new member, and verify new member can login.

### Implementation for User Story 2

- [X] T018 [P] [US2] Implement `AuthContext` for global state management in frontend/src/context/AuthContext.tsx
- [X] T019 [US2] Implement Axios interceptor for Bearer token injection in frontend/src/App.tsx
- [X] T020 [P] [US2] Create `LoginForm` component in frontend/src/components/LoginForm.tsx
- [X] T021 [US2] Create `ProtectedRoute` component in frontend/src/components/ProtectedRoute.tsx
- [X] T022 [US2] Integrate `AuthContext` and routing in frontend/src/App.tsx
- [X] T023 [P] [US2] Implement `CreateUser` database logic in backend/db.go
- [X] T024 [US2] Implement `CreateUser` handler with Admin-only check in backend/handlers.go
- [X] T025 [US2] Register `POST /api/users` route in backend/main.go
- [X] T026 [US2] Create User Management UI in frontend/src/components/UserManagement.tsx

**Checkpoint**: User Story 2 functional - multi-user support and persistent UI sessions ready.

---

## Phase 5: User Story 4 - Secure Logout (Priority: P3)

**Goal**: Enable users to securely terminate their local session.

**Independent Test**: Click Logout and verify dashboard is no longer accessible without re-login.

### Implementation for User Story 4

- [X] T027 [US4] Implement `logout` function in `AuthContext.tsx`
- [X] T028 [US4] Add Logout button to Dashboard header in frontend/src/App.tsx

**Checkpoint**: User Story 4 functional - session lifecycle complete.

---

## Phase N: Polish & Cross-Cutting Concerns

**Purpose**: Final refinements and verification

- [X] T029 [P] Implement password validation (min-length) in backend/handlers.go
- [X] T030 [P] Add token expiry handling (redirect to login) in Axios interceptors
- [X] T031 [P] Verify SC-004: Simulate token expiration (e.g., short-lived test token) and verify rejection in backend/auth/jwt_test.go
- [X] T032 [P] Run quickstart.md verification for full auth flow

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Independent.
- **Foundational (Phase 2)**: Depends on Phase 1.
- **User Story 1 (P1)**: Depends on Phase 2.
- **User Story 2 (P2)**: Depends on User Story 1.
- **User Story 4 (P3)**: Depends on User Story 2 (UI context).

### Parallel Opportunities

- T001 and T002 (Dependency installation) can run in parallel.
- T007, T008 (Unit tests) can be developed alongside T006.
- T011 (Middleware tests) can be developed alongside T010.
- Backend DB work (T023) and Frontend context (T018) can run in parallel.

---

## Implementation Strategy

### MVP First (User Story 1 Only)
1. Complete Setup and Foundational (including unit tests).
2. Implement backend login and middleware.
3. Verify basic protection and performance via `curl`.

### Incremental Delivery
1. Add frontend auth state and login form.
2. Add user management interface for admins.
3. Add logout, simulate expiry verification, and polish.
