# Implementation Plan: Dashboard Filtering and Search

**Branch**: `008-dashboard-filter-search` | **Date**: 2026-02-25 | **Spec**: `/specs/008-dashboard-filter-search/spec.md`
**Input**: Implement backend-driven log filtering, keyword search with debouncing, and pagination.

## Summary
Upgrade the EchoCenter Dashboard from a static "latest 50" view to a dynamic searchable log interface. This involves updating the Go backend to handle query parameters for filtering and pagination, and building a modern Shadcn-based "Filter Bar" in the React frontend with debounced search input.

## Technical Context

**Language/Version**: Go 1.22+, TypeScript (React)
**Primary Dependencies**: Gin (Backend), Shadcn/ui (Select, Input, Button), Lucide React
**Storage**: SQLite
**Testing**: `go test` for query builders, Vitest for frontend debounce logic.
**Target Platform**: Web
**Project Type**: Full-stack Feature Expansion
**Performance Goals**: <200ms response time for filtered log queries.
**Constraints**: Must maintain real-time feel while allowing historical deep-dives.

## Constitution Check

1. **Pragmatic Minimalism**: Does this use existing message schema? (✅ Yes, just adds WHERE clauses to queries).
2. **Idiomatic Implementation**: Uses Gin query binding and standard SQL `OFFSET/LIMIT`. (✅ Yes)
3. **Transparency**: Explicit loading states during background fetches. (✅ Yes)
4. **Disciplined Iteration**: Phase 1 (Backend parameters) -> Phase 2 (Frontend UI). (✅ Yes)

## Project Structure

### Backend Changes
```text
backend/internal/
├── database/
│   └── database.go      # Update GetLatestMessages to accept filters
├── handlers/
│   └── handlers.go      # Update GetMessages to bind query params
```

### Frontend Changes
```text
frontend/src/
├── components/
│   └── LogFilterBar.tsx # New component for search/filters
├── pages/
│   └── DashboardPage.tsx # Integration of filters and pagination
```

## Phases

### Phase 0: Outline & Research
- Define the debounce timeout (500ms) and hook implementation.
- Research SQL `LIKE` vs Full-Text Search (FTS) for content filtering (Stick to `LIKE` for MVP simplicity).

### Phase 1: Design & Contracts
- Update `GET /api/messages` contract to include optional query params.
- Define the "Load More" state transition logic.

### Phase 2: Backend Implementation
- Implement dynamic SQL generation in `database.go`.
- Add unit tests for various filter combinations.

### Phase 3: Frontend Implementation
- Build `LogFilterBar` using Shadcn primitives.
- Implement the "Load More" button and state management in `DashboardPage`.
- Wire up the debounced search input.
