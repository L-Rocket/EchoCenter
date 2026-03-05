# EchoCenter Backend

Lightweight message ingestion service.

## API Endpoints

### POST /api/messages
Ingests a new message.
- Content-Type: `application/json`
- Payload: `{"agent_id": "string", "level": "string", "content": "string"}`
- Levels: `INFO`, `WARNING`, `ERROR`

### GET /api/messages
Retrieves latest 50 messages.
- Returns: Array of messages in reverse chronological order.

## Database
Default database is SQLite via `DB_PATH`.
Set `DB_DRIVER=postgres` to use PostgreSQL via `DB_DSN`.
If `DB_DSN` is empty, DSN is built from `PG_HOST`, `PG_PORT`, `PG_USER`, `PG_PASSWORD`, `PG_DATABASE`, `PG_SSLMODE`.

## Mock Dev Endpoints
`/api/dev/mock/*` endpoints are enabled only when `APP_ENV` is not `production`.

When `DB_DRIVER=postgres`, `make run-mock` automatically ensures (or recreates when `RESET=1`) the target database before backend startup.

## Mock Bootstrap Commands
- `make run-mock` - unified entry, follows `.env` `DB_DRIVER` (or command-line override).
- `DB_DRIVER=sqlite make run-mock RESET=1` - reset + run with SQLite.
- `DB_DRIVER=postgres make run-mock RESET=1` - reset + run with PostgreSQL.
- `make run-mock-sqllite` / `make run-mock-postgre` - deprecated compatibility aliases.
