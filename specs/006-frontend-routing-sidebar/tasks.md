# Tasks: Frontend Routing and Sidebar Refactor

**Input**: Design documents from `/specs/006-frontend-routing-sidebar/`
**Prerequisites**: plan.md, spec.md, research.md

**Organization**: Tasks are grouped by implementation phase to ensure a stable migration from state-based navigation to route-based navigation.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize dependencies and project structure for routing.

- [X] T001 [P] Install `react-router-dom` in `frontend/`
- [X] T002 Create directory structure: `frontend/src/pages/` and `frontend/src/components/layout/`

---

## Phase 2: Page Extraction (Foundational)

**Purpose**: Modularize existing UI logic into dedicated page components.

- [X] T003 [P] Create `LoginPage` in `frontend/src/pages/LoginPage.tsx` by extracting the login view logic from `App.tsx`
- [X] T004 [P] Create `DashboardPage` in `frontend/src/pages/DashboardPage.tsx` by extracting the System Logs view from `App.tsx`
- [X] T005 [P] Create `AgentsPage` in `frontend/src/pages/AgentsPage.tsx` by extracting the Agent list and chat logic from `App.tsx`
- [X] T006 [P] Create `TeamPage` in `frontend/src/pages/TeamPage.tsx` by extracting the User Management logic from `App.tsx`

**Checkpoint**: Page extraction complete - all business logic is now modular and ready for routing.

---

## Phase 3: Sidebar & Layout Refactor (Shadcn/ui)

**Purpose**: Implement the new responsive sidebar and layout shell.

- [X] T007 [P] Add Shadcn `Sidebar`, `Separator`, and `Sheet` primitives in `frontend/src/components/ui/`
- [X] T008 [P] Implement `AppSidebar` component using Shadcn primitives in `frontend/src/components/layout/AppSidebar.tsx`
- [X] T009 Implement `MainLayout` shell in `frontend/src/components/layout/MainLayout.tsx` using `AppSidebar` and `<Outlet />`
- [ ] T010 [P] Implement unit tests for `AppSidebar` navigation item visibility based on user roles in `frontend/src/components/layout/AppSidebar.test.tsx` (Skipped for MVP speed)

---

## Phase 4: Routing & Protection (Priority: P1) 🎯 MVP

**Goal**: Establish the core routing system and secure protected views.

**Independent Test**: Manually navigate to `/agents` and verify redirect to `/login` if unauthenticated.

### Implementation for User Story 1 & 2

- [X] T011 Create `RequireAuth` wrapper component in `frontend/src/components/layout/RequireAuth.tsx` to handle authentication checks
- [X] T012 Setup `BrowserRouter` and define all routes (`/login`, `/dashboard`, `/agents`, `/team`) in `frontend/src/App.tsx`
- [X] T013 Implement `404 Not Found` page or redirect in `frontend/src/App.tsx`
- [ ] T014 [P] Implement unit tests for `RequireAuth` redirect logic in `frontend/src/components/layout/RequireAuth.test.tsx` (Skipped for MVP speed)

**Checkpoint**: Routing functional - system supports deep linking and authentication gates.

---

## Phase 5: Mobile & Visual Polish (Priority: P2)

**Purpose**: Ensure the new sidebar works perfectly on mobile and has a high-quality feel.

**Independent Test**: Resize browser to 375px and verify the sidebar transforms into a collapsible sheet/hamburger menu.

### Implementation for User Story 3

- [X] T015 [US3] Configure Shadcn Sidebar mobile toggle (Sheet) in `AppSidebar.tsx`
- [X] T016 [US3] Apply active state highlighting to sidebar links using React Router `NavLink`
- [X] T017 [US3] Add smooth transition animations for sidebar toggle and route changes

---

## Phase N: Polish & Cross-Cutting Concerns

**Purpose**: Final verification and cleanup.

- [X] T018 [P] Remove all legacy view-state logic and top-bar navigation from `App.tsx`
- [X] T019 [P] Run production build and verify asset size in `frontend/`
- [X] T020 Run full integration verification: Login -> Navigate via Sidebar -> Deep link to Agents -> Resize to Mobile

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Independent.
- **Page Extraction (Phase 2)**: Depends on Phase 1.
- **Sidebar & Layout (Phase 3)**: Depends on Phase 1.
- **Routing (Phase 4)**: Depends on Phase 2 and 3.
- **Polish (Phase N)**: Depends on all previous phases.

### Parallel Opportunities

- All [P] tasks in Phase 2 can run simultaneously.
- `AppSidebar` development (T008) can run alongside Page extraction (T003-T006).
- Unit testing (T010, T014) can run in parallel with their respective implementation tasks.

---

## Implementation Strategy

### MVP First (Functional Routing)
1. Complete Setup and Page Extraction.
2. Implement basic MainLayout without advanced Sidebar features.
3. Configure core Routes and RequireAuth.
4. **STOP and VALIDATE**: Verify URL navigation works.

### Incremental Delivery
1. Add advanced Sidebar features (Role-based links, active highlighting).
2. Implement Mobile responsiveness.
3. Final cleanup and legacy code removal.
