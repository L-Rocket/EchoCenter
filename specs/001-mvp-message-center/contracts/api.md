# API Contracts: EchoCenter MVP

## POST /api/messages
Ingests a new agent status report.

### Request Body (JSON)
```json
{
  "agent_id": "agent-123",
  "level": "INFO",
  "content": "Agent initialized successfully."
}
```

### Responses
- **201 Created**: Message successfully ingested and stored.
  ```json
  {
    "id": 1,
    "agent_id": "agent-123",
    "level": "INFO",
    "content": "Agent initialized successfully.",
    "timestamp": "2026-02-25T14:30:00Z"
  }
  ```
- **400 Bad Request**: Invalid payload or missing required fields.
  ```json
  {
    "error": "agent_id is required"
  }
  ```

---

## GET /api/messages
Retrieves the latest messages for the dashboard.

### Query Parameters
- `limit` (optional): Number of messages to retrieve (default: 50).

### Responses
- **200 OK**: List of the most recent messages, ordered by timestamp (newest first).
  ```json
  [
    {
      "id": 2,
      "agent_id": "agent-124",
      "level": "WARNING",
      "content": "Memory usage above 80%.",
      "timestamp": "2026-02-25T14:35:00Z"
    },
    {
      "id": 1,
      "agent_id": "agent-123",
      "level": "INFO",
      "content": "Agent initialized successfully.",
      "timestamp": "2026-02-25T14:30:00Z"
    }
  ]
  ```

---

## CORS Configuration
The backend MUST allow the following:
- **Methods**: GET, POST, OPTIONS.
- **Headers**: Content-Type, Authorization.
- **Origin**: Frontend dev server (e.g., `http://localhost:5173`) and any production origins.
