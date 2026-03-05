# EchoCenter Backend

EchoCenter backend provides:
- JWT authentication
- WebSocket chat/event routing
- Butler orchestration and authorization workflow
- Agent registration + token lifecycle
- Feishu long-connection (WebSocket) integration

## Runtime

```bash
# Development
go run cmd/server/main.go

# Build
go build -o bin/server ./cmd/server
./bin/server
```

## Database

- Default: SQLite (`DB_DRIVER=sqlite`, `DB_PATH=./data/echo_center.db`)
- Optional: PostgreSQL (`DB_DRIVER=postgres`)
  - Use `DB_DSN` directly, or split config with `PG_HOST`, `PG_PORT`, `PG_USER`, `PG_PASSWORD`, `PG_DATABASE`, `PG_SSLMODE`

## Feishu Integration (Current Mode)

- Uses Feishu long connection (`FEISHU_WS_ENABLED=true`)
- No public Feishu event callback route is required for message ingestion
- Connector verification (`/api/integrations/feishu/:id/verify-callback`) performs real credential validation against Feishu auth API
- Supports:
  - inbound message routing to Butler
  - Butler outbound reply relay to Feishu
  - Feishu interactive cards for Butler authorization approval/rejection

## Mock Bootstrap

`make run-mock` starts backend + seed + mock agent + frontend.

Key behavior:
- `RESET` default is `1` in root `Makefile`
- `RESET=1` calls `/api/dev/mock/reset` before seeding
- For PostgreSQL, `backend/cmd/mockdb` recreates the target DB when `RESET=1`

Examples:

```bash
DB_DRIVER=sqlite make run-mock RESET=1
DB_DRIVER=postgres make run-mock RESET=1
make run-mock RESET=0
```

Deprecated aliases:
- `make run-mock-sqllite`
- `make run-mock-postgre`
