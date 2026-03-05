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
