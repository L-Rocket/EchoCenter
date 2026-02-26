# Implementation Plan: Frontend Routing and Sidebar Refactor

**Branch**: `006-frontend-routing-sidebar` | **Date**: 2026-02-25 | **Spec**: `/specs/006-frontend-routing-sidebar/spec.md`
**Input**: Refactor frontend to use `react-router-dom` and a persistent left sidebar.

## Summary
Transform the existing monolithic `App.tsx` into a routed application. This involves setting up a layout-based routing system where unauthenticated users are directed to `/login`, and authenticated users see a consistent Sidebar + Main Content area. The refactor will leverage `Shadcn/ui` components for the sidebar and mobile responsiveness.

## Technical Context

**Language/Version**: TypeScript, React
**Primary Dependencies**: `react-router-dom`, `shadcn/ui`, `lucide-react`
**Storage**: N/A
**Testing**: Vitest for route protection logic and sidebar navigation.
**Target Platform**: Web
**Project Type**: Frontend Refactoring
**Constraints**: strictly frontend only, NO backend changes.

## Constitution Check

1. **Pragmatic Minimalism**: Does this refactor introduce unnecessary complexity? (✅ No, it's a standard and scalable way to manage SPA navigation).
2. **Idiomatic Implementation**: Uses the standard `Layout` pattern in React Router. (✅ Yes)
3. **Transparency**: Explicit route protection and 404 handling. (✅ Yes)
4. **Disciplined Iteration**: Phased move from state-based views to route-based views. (✅ Yes)

## Project Structure

### New Frontend Organization
```text
frontend/src/
├── components/
│   ├── layout/
│   │   ├── AppSidebar.tsx  # New persistent sidebar
│   │   └── MainLayout.tsx  # Layout wrapper with Sidebar + Content
│   └── ... (existing components)
├── pages/                  # Views extracted from App.tsx
│   ├── DashboardPage.tsx
│   ├── AgentsPage.tsx
│   ├── TeamPage.tsx
│   └── LoginPage.tsx
├── App.tsx                 # Now contains Route definitions
└── ...
```

## Phases

### Phase 1: Routing Setup & Page Extraction
- Install `react-router-dom` (if not present).
- Create the `pages/` directory and extract existing view logic into individual page components.
- Setup the basic `BrowserRouter` and `Routes` in `App.tsx`.

### Phase 2: Sidebar Refactor (Shadcn/ui)
- Implement `AppSidebar` using Shadcn primitives.
- Integrate the sidebar into a `MainLayout` component that uses `<Outlet />` for nested content.
- Ensure the sidebar adapts to mobile view using `Sheet` or standard Shadcn Sidebar behavior.

### Phase 3: Route Protection & Final Wiring
- Implement a `RequireAuth` component to protect `/dashboard`, `/agents`, and `/team`.
- Update navigation links to use `NavLink` for active state highlighting.
- Final polish of the sidebar transitions and visual consistency.
