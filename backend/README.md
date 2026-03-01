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
Uses SQLite stored in `./data/echo_center.db`.
