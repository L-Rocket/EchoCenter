# Tasks: Dashboard Filtering and Search

**Input**: Design documents from `/specs/008-dashboard-filter-search/`
**Prerequisites**: plan.md, spec.md, data-model.md, research.md, contracts/api.md

**Organization**: Tasks are ordered to build the backend filtering capability first, followed by the frontend UI and pagination logic.

## Phase 1: Backend Foundation

**Purpose**: Enable the API to handle filtering and pagination parameters.

- [X] T001 Update `GetLatestMessages` in `backend/internal/database/database.go` to accept `agentID`, `level`, `query`, `offset`, and `limit`
- [X] T002 Implement dynamic SQL generation with parameter binding in `backend/internal/database/database.go`
- [X] T003 Update `GetMessages` handler in `backend/internal/handlers/handlers.go` to bind optional query parameters
- [X] T004 [P] Implement unit tests for dynamic query builder in `backend/internal/database/database_test.go`
- [X] T005 [P] Implement integration tests for filtered API results in `backend/internal/handlers/handlers_test.go`

---

## Phase 2: Frontend Infrastructure

**Purpose**: Prepare hooks and state for the new dashboard capabilities.

- [X] T006 [P] Create `useDebounce` hook in `frontend/src/hooks/useDebounce.ts`
- [X] T007 Define `LogFilterState` and update `DashboardPage` state management in `frontend/src/pages/DashboardPage.tsx`
- [ ] T008 [P] Add unit tests for `useDebounce` hook in `frontend/src/hooks/useDebounce.test.ts` (Skipped for speed)

---

## Phase 3: Filter Bar UI (Priority: P1)

**Goal**: Implement the user-facing controls for filtering and search.

- [X] T009 [US1] Create `LogFilterBar` component using Shadcn `Input`, `Select`, and `Button` in `frontend/src/components/LogFilterBar.tsx`
- [X] T010 [US1] Implement Agent selection in `LogFilterBar.tsx` (fetch active agents for the dropdown)
- [X] T011 [US2] Integrate debounced search input into `LogFilterBar.tsx`
- [X] T012 [US1] Implement "Reset Filters" functionality in `LogFilterBar.tsx`
- [X] T013 [US1] [US2] Integrate `LogFilterBar` into `DashboardPage.tsx` and wire up API calls

**Checkpoint**: Basic filtering and debounced search are functional.

---

## Phase 4: Pagination & Load More (Priority: P2)

**Goal**: Support retrieving historical logs beyond the initial page.

- [X] T014 [US3] Implement `handleLoadMore` logic in `DashboardPage.tsx` to append results
- [X] T015 [US3] Add "Load More" button component at the bottom of the message list in `frontend/src/pages/DashboardPage.tsx`
- [X] T016 [US3] Implement "End of Logs" visual state when no more records are returned
- [X] T017 [US3] Add loading spinner state for pagination requests in `DashboardPage.tsx`

---

## Phase 5: WebSocket Coordination & Polish

**Purpose**: Ensure real-time updates don't conflict with historical investigations.

- [X] T018 Implement logic to pause or conditionalize WebSocket log prepending when filters are active in `DashboardPage.tsx`
- [X] T019 Apply responsive styling to the `LogFilterBar` for mobile views
- [X] T020 Run full integration verification: Search -> Filter -> Load More -> Reset

---

## Dependencies & Execution Order

### Phase Dependencies

- **Backend Foundation (Phase 1)**: Independent.
- **Frontend Infrastructure (Phase 2)**: Independent.
- **Filter Bar UI (Phase 3)**: Depends on Phase 1 and 2.
- **Pagination (Phase 4)**: Depends on Phase 1 and 3.
- **Polish (Phase 5)**: Depends on all previous phases.

### Parallel Opportunities

- Backend logic (`T001-T005`) and Frontend hooks (`T006-T008`) can run simultaneously.
- UI components (`T009-T010`) can be built while backend tests are running.

---

## Implementation Strategy

### MVP First (Backend + Basic UI)
1. Complete Phase 1 (API Support).
2. Complete Phase 2 and Phase 3 (Filter Bar).
3. **STOP and VALIDATE**: Verify that selecting an Agent correctly filters the list.

### Incremental Delivery
1. Add Debounce to the search input.
2. Implement "Load More" pagination.
3. Final WebSocket coordination.
