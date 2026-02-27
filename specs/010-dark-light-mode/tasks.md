# Tasks: Dark and Light Mode Toggle

**Input**: Design documents from `/specs/010-dark-light-mode/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [x] T001 [P] Verify CSS variables for dark mode in `frontend/src/index.css`
- [x] T002 [P] Confirm `lucide-react` icons (Sun, Moon) are available in `frontend/package.json`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

- [x] T003 Create `frontend/src/components/theme-provider.tsx` with `Theme` type and context skeleton

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Manual Theme Switching (Priority: P1) 🎯 MVP

**Goal**: User can manually toggle between dark and light themes in the UI.

**Independent Test**: Clicking the toggle button changes the application colors immediately.

### Implementation for User Story 1

- [x] T004 [US1] Implement `ThemeProvider` logic to apply the `.dark` class to `document.documentElement` in `frontend/src/components/theme-provider.tsx`
- [x] T005 [P] [US1] Create simple theme toggle button in `frontend/src/components/mode-toggle.tsx` using `lucide-react` icons
- [x] T006 [US1] Wrap application root with `ThemeProvider` in `frontend/src/App.tsx`
- [x] T007 [US1] Insert `ModeToggle` into the header of `frontend/src/components/layout/MainLayout.tsx` (top-right location)

**Checkpoint**: At this point, User Story 1 should be fully functional (manual switching works, but resets on refresh).

---

## Phase 4: User Story 2 - Preference Persistence (Priority: P1)

**Goal**: Application remembers the user's theme choice across browser sessions.

**Independent Test**: Select a theme, refresh the page; the theme should remain active without flashing.

### Implementation for User Story 2

- [x] T008 [US2] Update `ThemeProvider` to save and load theme preference from `localStorage` (`vite-ui-theme`) in `frontend/src/components/theme-provider.tsx`
- [x] T009 [US2] Add inline `<script>` to `frontend/index.html` to apply theme class before hydration (prevents FOUC)

**Checkpoint**: User Story 2 complete; persistence works and FOUC is prevented.

---

## Phase 5: User Story 3 - System Preference Synchronization (Priority: P2)

**Goal**: Automatically match the operating system's theme preference by default.

**Independent Test**: Set theme to "System", change OS theme, app follows automatically.

### Implementation for User Story 3

- [x] T010 [US3] Implement `window.matchMedia` listener in `ThemeProvider` to handle "system" theme logic in `frontend/src/components/theme-provider.tsx`
- [x] T011 [US3] Update `ModeToggle` in `frontend/src/components/mode-toggle.tsx` to include the "System" option

**Checkpoint**: All user stories complete; system synchronization works correctly.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements and final validation.

- [x] T012 [P] Refine CSS transitions for theme switching in `frontend/src/index.css` to ensure smooth color changes
- [x] T013 Run `quickstart.md` validation to verify all scenarios

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Phase 1.
- **User Stories (Phase 3+)**: All depend on Phase 2.
  - US1 (Phase 3) is the MVP and should be completed first.
  - US2 and US3 build upon US1.
- **Polish (Phase 6)**: Depends on all user stories.

### Parallel Opportunities

- T001 and T002 can run in parallel.
- T005 can be developed in parallel with T004.
- T012 can be worked on after US1 is functional.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Setup and Foundational work.
2. Implement manual toggle and context logic (US1).
3. Verify that clicking the button changes the UI colors.

### Incremental Delivery

1. Foundation + US1 -> Manual toggle works.
2. Add US2 -> Persistence works (survives refresh).
3. Add US3 -> System sync works.
