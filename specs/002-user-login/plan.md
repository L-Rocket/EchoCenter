# Implementation Plan: User Login

**Branch**: `002-user-login` | **Date**: 2026-02-25 | **Spec**: `/specs/002-user-login/spec.md`
**Input**: Add authentication and user management to EchoCenter.

## Summary
Implement a JWT-based authentication system for EchoCenter. This includes backend user storage, password hashing (bcrypt), login/user-creation APIs, and a frontend login page with protected routing using React Context.

## Technical Context

**Language/Version**: Go 1.22+, TypeScript
**Primary Dependencies**: 
- Backend: `github.com/golang-jwt/jwt/v5`, `golang.org/x/crypto/bcrypt`, `github.com/joho/godotenv`
- Frontend: `axios`, `react-router-dom` (if not already present), `jwt-decode`
**Storage**: Relational database (`users` table)
**Testing**: `go test` for auth logic, `curl` for API verification.
**Target Platform**: Local environment
**Project Type**: Web application
**Constraints**: Popular, stateless tech (JWT); Secure password storage (Bcrypt).

## Constitution Check

1. **Pragmatic Minimalism**: Does this plan use high-leverage libs for complex problems? (✅ Yes, JWT and Bcrypt libs avoid custom crypto).
2. **Idiomatic Implementation**: Follows standard Go/React patterns.
3. **Transparency**: Explicit error responses for unauthorized access.
4. **Disciplined Iteration**: Phase-based implementation.

## Project Structure

### Documentation (this feature)
```text
specs/002-user-login/
├── plan.md
├── research.md
├── data-model.md
├── contracts/
└── tasks.md (to be generated)
```

### Source Code Changes
```text
backend/
├── auth/
│   ├── jwt.go          # Token signing and validation
│   └── middleware.go   # Gin middleware for protected routes
├── cmd/seed/           # (Optional) Admin initialization logic
├── .env.example        # Template for secrets
└── ... (existing files)

frontend/
├── src/
│   ├── context/
│   │   └── AuthContext.tsx # Global auth state
│   ├── components/
│   │   ├── ProtectedRoute.tsx
│   │   └── LoginForm.tsx
│   └── ...
```

## Phases

### Phase 1: Backend Foundation (User & JWT)
- Implement `users` table and `User` model.
- Implement Password hashing and JWT signing utilities.
- Implement Admin initialization from environment variables.

### Phase 2: Auth APIs & Middleware
- Implement `POST /api/auth/login`.
- Implement Gin middleware for token verification.
- Apply middleware to existing `/api/messages` routes.

### Phase 3: Frontend Auth Integration
- Implement `AuthContext` and Axios interceptors.
- Create Login Page and redirect logic.
- Implement "Invite User" interface for Admin.
