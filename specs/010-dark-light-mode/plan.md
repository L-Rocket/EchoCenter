# Implementation Plan: Dark and Light Mode Toggle

**Branch**: `010-dark-light-mode` | **Date**: 2026-02-27 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/010-dark-light-mode/spec.md`

## Summary

Implement a user-facing dark and light mode toggle switch using a popular and idiomatic approach. The feature will use a React Context provider to manage theme state (`light`, `dark`, `system`), persist preferences to `localStorage`, and apply the `.dark` class to the HTML root, leveraging the existing Tailwind CSS configuration. The toggle will be located in the top-right corner of the application's layout.

## Technical Context

**Language/Version**: TypeScript 5.9.3, React 19.2
**Primary Dependencies**: `tailwindcss` 4.2, `lucide-react`, `radix-ui` (via shadcn/ui)
**Storage**: Browser `localStorage` (Client-side only)
**Testing**: `vitest`, `@testing-library/react`
**Target Platform**: Web browsers
**Project Type**: Frontend Web Application
**Performance Goals**: < 50ms JS execution to apply theme on load to prevent FOUC.
**Constraints**: Must synchronize with OS-level `prefers-color-scheme` media queries when set to 'system'.
**Scale/Scope**: Affects all UI components globally via CSS variables.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Pragmatic Minimalism**: PASS. Using a standard, localized React Context avoids over-engineering. No new heavy dependencies are introduced; relying on existing Tailwind capabilities.
- **II. Idiomatic & High-Leverage Implementation**: PASS. The standard Vite + Tailwind + shadcn/ui pattern (`ThemeProvider`) is being adopted precisely as designed for this ecosystem.
- **III. Transparency & Fail-Fast Mechanics**: PASS. The fallback behavior (defaulting to system preference or light mode) ensures the UI remains functional even if `localStorage` access is restricted.
- **IV. Disciplined Iteration**: PASS. The feature is self-contained and atomic.
- **V. Practical Testing**: PASS. Will require unit tests for the context provider and manual testing for visual regressions.

## Project Structure

### Documentation (this feature)

```text
specs/010-dark-light-mode/
├── plan.md              
├── research.md          
├── data-model.md        
├── quickstart.md        
├── contracts/           
└── tasks.md             
```

### Source Code (repository root)

```text
frontend/
├── index.html                   # Add inline script to prevent FOUC
└── src/
    ├── components/
    │   ├── theme-provider.tsx   # New: React Context for theme management
    │   ├── mode-toggle.tsx      # New: UI Button/Dropdown to switch themes
    │   └── layout/
    │       └── MainLayout.tsx   # Modified: Inject ModeToggle into top-right header
    ├── lib/
    │   └── utils.ts
    └── App.tsx                  # Modified: Wrap application in ThemeProvider
```

**Structure Decision**: The implementation stays entirely within the `frontend/` application. We introduce a `theme-provider.tsx` and a `mode-toggle.tsx` component, modifying `MainLayout.tsx` to display the toggle and `App.tsx` (or `main.tsx`) to supply the context.

## Complexity Tracking

*No constitution violations. Standard implementation pattern utilized.*
