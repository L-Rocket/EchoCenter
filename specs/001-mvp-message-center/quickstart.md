# Quickstart: EchoCenter MVP

## Prerequisites
- **Go**: 1.22+
- **Node.js**: 18+ (npm or pnpm)
- **SQLite**: Local environment (no separate installation required for Go modernc.org/sqlite)

## Backend Setup (Go API)
1. `cd backend`
2. `go mod tidy`
3. `go run main.go`
   - The server will start on `http://localhost:8080`.
   - The SQLite database file `echocenter.db` will be automatically initialized.

## Frontend Setup (React + Vite)
1. `cd frontend`
2. `npm install`
3. `npm run dev`
   - The dashboard will be accessible at `http://localhost:5173`.

## Ingestion Test (via curl)
```bash
curl -X POST http://localhost:8080/api/messages 
     -H "Content-Type: application/json" 
     -d '{"agent_id": "test-agent", "level": "INFO", "content": "EchoCenter is online!"}'
```

## Dashboard Access
1. Open a browser to `http://localhost:5173`.
2. The dashboard will automatically update with the message you just ingested.
