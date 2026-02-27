# API Contracts: Dashboard Filtering and Search

## GET /api/messages
Retrieves status logs with optional filtering and pagination.

### Auth
- **Required**: Bearer Token (JWT).

### Query Parameters
| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| `agent_id` | string | Filter by agent name | null |
| `level` | string | Filter by severity (INFO, WARNING, ERROR) | null |
| `q` | string | Search keyword in message content | null |
| `offset` | integer | Starting index for pagination | 0 |
| `limit` | integer | Number of records to return | 50 |

### Responses
- **200 OK**: Array of Message objects.
  ```json
  [
    {
      "id": 123,
      "agent_id": "Weather-Sentinel",
      "level": "INFO",
      "content": "Atmospheric scan complete.",
      "timestamp": "2026-02-25T14:00:00Z"
    }
  ]
  ```
- **401 Unauthorized**: Missing or invalid token.
