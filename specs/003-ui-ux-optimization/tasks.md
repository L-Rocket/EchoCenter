# Tasks: UI/UX Optimization

**Input**: Design documents from `/specs/003-ui-ux-optimization/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ui-standards.md

**Organization**: Tasks are grouped by implementation phase and user story to enable independent testing and verification.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize the design system and styling tools.

- [X] T001 Initialize Shadcn/ui using `npx shadcn@latest init` in frontend/
- [X] T002 Configure global Tailwind theme variables (Slate/Indigo) in frontend/src/index.css
- [X] T003 [P] Install `lucide-react` icons in frontend/

---

## Phase 2: Foundational (UI Primitives)

**Purpose**: Install the core building blocks from Shadcn/ui.

- [X] T004 [P] Add Shadcn Card primitive in frontend/src/components/ui/card.tsx
- [X] T005 [P] Add Shadcn Badge primitive in frontend/src/components/ui/badge.tsx
- [X] T006 [P] Add Shadcn Button primitive in frontend/src/components/ui/button.tsx
- [X] T007 [P] Add Shadcn ScrollArea primitive in frontend/src/components/ui/scroll-area.tsx
- [X] T008 [P] Add Shadcn Input primitive in frontend/src/components/ui/input.tsx
- [X] T009 [P] Create `StatusIndicator` custom primitive in frontend/src/components/ui/status-indicator.tsx
- [X] T010 [P] Implement unit tests for component variants (Badge, Button) in frontend/src/components/ui/ui.test.tsx
- [X] T011 Create `MainLayout` wrapper component with consistent Header/Footer in frontend/src/components/MainLayout.tsx

**Checkpoint**: Foundation ready - basic design system and layout structure are in place.

---

## Phase 3: User Story 1 - Modern Dashboard Redesign (Priority: P1) 🎯 MVP

**Goal**: Redesign the message feed for better readability and professional look.

**Independent Test**: Open the dashboard and verify that message rows are clean, well-spaced, and levels are visually distinct.

### Implementation for User Story 1

- [X] T012 [P] [US1] Implement unit tests for `MessageRow` status mapping logic in frontend/src/components/MessageRow.test.tsx
- [X] T013 [US1] Refactor `MessageRow` to use Shadcn `Card` and `Badge` in frontend/src/components/MessageRow.tsx
- [X] T014 [US1] Implement visual status icons (Lucide icons) based on level in frontend/src/components/MessageRow.tsx
- [X] T015 [US1] Redesign main Dashboard view with `MainLayout` and proper spacing in frontend/src/App.tsx
- [X] T016 [US1] Create a polished `EmptyState` component for when no messages exist in frontend/src/components/EmptyState.tsx

**Checkpoint**: Dashboard redesigned - core value proposition has a modern professional UI.

---

## Phase 4: User Story 3 - Responsive & Fluid Layout (Priority: P2)

**Goal**: Ensure the UI works perfectly on all screen sizes.

**Independent Test**: Resize browser to 375px and verify cards stack correctly and padding is appropriate.

### Implementation for User Story 3

- [X] T017 [US3] Apply responsive container classes (`max-w-5xl`, `mx-auto`) in frontend/src/components/MainLayout.tsx
- [X] T018 [US3] Adjust mobile-specific padding and font sizes in `App.tsx` and `MessageRow.tsx`

---

## Phase 5: User Story 2 - Consistent UI Primitives (Priority: P2)

**Goal**: Bring login and user management into the new design system.

**Independent Test**: Navigate to login and management views and verify they share the same Shadcn styling.

### Implementation for User Story 2

- [X] T019 [US2] Redesign `LoginForm` using Shadcn `Input`, `Card`, and `Button` in frontend/src/components/LoginForm.tsx
- [X] T020 [US2] Redesign `UserManagement` form using Shadcn primitives in frontend/src/components/UserManagement.tsx
- [X] T021 [US2] Polish Header navigation and user profile display using Shadcn/Lucide in frontend/src/components/MainLayout.tsx

**Checkpoint**: Full UI consistency - all screens follow the new design language.

---

## Phase N: Polish & Cross-Cutting Concerns

**Purpose**: Final quality assurance.

- [X] T022 [P] Final CSS variable fine-tuning for consistent Indigo/Slate palette in frontend/src/index.css
- [X] T023 [P] Accessibility audit: Verify ARIA attributes and color contrast across the app
- [X] T024 [P] Run production build and verify asset size/performance in frontend/

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Independent.
- **Foundational (Phase 2)**: Depends on Phase 1.
- **User Story 1 (P1)**: Depends on Phase 2.
- **User Story 3 (P2)**: Depends on User Story 1.
- **User Story 2 (P2)**: Depends on Phase 2.

### Parallel Opportunities

- All [P] tasks in Setup and Foundational can run in parallel.
- Redesigning `LoginForm` (T016) can run in parallel with Dashboard work (Phase 3).
- Polish tasks (T019-T021) can run in parallel after individual stories are completed.

---

## Implementation Strategy

### MVP First (Redesigned Dashboard)
1. Complete Setup and Foundational primitives.
2. Implement User Story 1 (Dashboard Redesign).
3. Verify visual quality and responsiveness.

### Incremental Delivery
1. Update supporting pages (Login, User Management) to match.
2. Final polish and accessibility check.
