# EchoCenter Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-02-26

## Active Technologies
- SQLite (`users` table) (002-user-login)
- TypeScript, Reac + `shadcn/ui`, `lucide-react`, `tailwindcss`, `radix-ui` (003-ui-ux-optimization)
- N/A (Frontend only) (003-ui-ux-optimization)
- Go 1.22+ + Gin, JWT, Bcrypt, Godotenv, SQLite (004-backend-restructure)
- SQLite (Path management is critical during move) (004-backend-restructure)
- Go 1.22+, TypeScrip + `github.com/gorilla/websocket` (Backend), `shadcn/ui`, `lucide-react`, `zustand` (Frontend state) (005-agent-chat-integration)
- SQLite (Agent registration), In-memory (Volatile chat history) (005-agent-chat-integration)
- TypeScript, Reac + `react-router-dom`, `shadcn/ui`, `lucide-react` (006-frontend-routing-sidebar)
- Go 1.22+, TypeScrip + Gorilla WebSocket, Gin, Zustand (007-chat-history-persistence)
- SQLite (`chat_messages` table) (007-chat-history-persistence)
- Go 1.22+, TypeScript (React) + Gin (Backend), Shadcn/ui (Select, Input, Button), Lucide Reac (008-dashboard-filter-search)

- Go 1.22+, TypeScript (Frontend) + Gin (Backend), React, Vite, Tailwind CSS (Frontend) (001-mvp-message-center)

## Project Structure

```text
src/
tests/
```

## Commands

npm test && npm run lint

## Code Style

Go 1.22+, TypeScript (Frontend): Follow standard conventions

## Recent Changes
- 008-dashboard-filter-search: Added Go 1.22+, TypeScript (React) + Gin (Backend), Shadcn/ui (Select, Input, Button), Lucide Reac
- 007-chat-history-persistence: Added Go 1.22+, TypeScrip + Gorilla WebSocket, Gin, Zustand
- 006-frontend-routing-sidebar: Added TypeScript, Reac + `react-router-dom`, `shadcn/ui`, `lucide-react`


<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
