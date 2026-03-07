# Implementation Plan: Backend Directory Standardizing

**Branch**: `004-backend-restructure` | **Date**: 2026-02-25 | **Spec**: `/specs/004-backend-restructure/spec.md`
**Input**: Reorganize the backend directory structure to follow Go standard layout (`cmd/` and `internal/`).

## Summary
The current flat structure of the `backend/` directory will be reorganized into a standard Go project layout. This will improve code organization, separation of concerns, and scalability. All existing logic (Auth, DB, Handlers, Models) will be moved into dedicated internal packages, and the entry point will be moved to `cmd/server`.

## Technical Context

**Language/Version**: Go 1.22+
**Primary Dependencies**: Gin, JWT, Bcrypt, Godotenv, database driver
**Storage**: Relational database (path management is critical during move)
**Testing**: Existing unit tests must pass after package path updates.
**Target Platform**: Local environment
**Project Type**: Backend Restructuring
**Constraints**: strictly backend only, NO frontend changes, NO logic changes.

## Constitution Check

1. **Pragmatic Minimalism**: Does this add unnecessary layers? (✅ No, it follows standard ecosystem patterns for better discovery).
2. **Idiomatic Implementation**: Follows standard Go project layout (`cmd/`, `internal/`). (✅ Yes)
3. **Transparency**: Clear package boundaries improve inspectability. (✅ Yes)
4. **Disciplined Iteration**: Phase-based move to ensure build stability at each step. (✅ Yes)

## Project Structure

### New Backend Layout
```text
backend/
├── cmd/
│   └── server/
│       └── main.go         # Entry point (migrated from root)
├── internal/
│   ├── auth/               # Auth logic & middleware (migrated from root/auth)
│   ├── database/           # DB init & operations (migrated from db.go)
│   ├── handlers/           # HTTP Handlers (migrated from handlers.go)
│   └── models/             # Data structures (migrated from models.go)
├── .env                    # Remains at root
├── go.mod                  # Remains at root
└── go.sum                  # Remains at root
```

## Phases

### Phase 1: Models & Auth Migration
- Create `internal/models` and `internal/auth`.
- Move `models.go` and the `auth/` directory logic.
- Update internal imports within these packages.

### Phase 2: Database & Handlers Migration
- Create `internal/database` and `internal/handlers`.
- Move `db.go` and `handlers.go`.
- Update internal imports and fix package declarations.

### Phase 3: Entry Point & Verification
- Create `cmd/server` and move `main.go`.
- Update all remaining imports to the new package paths.
- Verify path resolution for `.env` and `echocenter.db`.
- Run all unit tests and manual `curl` verification.
