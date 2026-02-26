# Data Model: EchoCenter MVP

## Entity: AgentMessage
Represents a single status report from an external AI Agent.

### Attributes (SQLite Table `messages`)
| Field | Type | Description | Constraints |
|-------|------|-------------|-------------|
| `id` | INTEGER | Primary key | AUTOINCREMENT |
| `agent_id` | TEXT | Identifier of the reporting agent | NOT NULL |
| `level` | TEXT | Message severity (INFO, WARNING, ERROR) | NOT NULL |
| `content` | TEXT | The actual message text | NOT NULL |
| `timestamp` | DATETIME | When the message was received (UTC) | DEFAULT CURRENT_TIMESTAMP |

### Go Struct Mapping
```go
type Message struct {
	ID        int       `json:"id" db:"id"`
	AgentID   string    `json:"agent_id" db:"agent_id" binding:"required"`
	Level     string    `json:"level" db:"level" binding:"required"`
	Content   string    `json:"content" db:"content" binding:"required"`
	Timestamp time.Time `json:"timestamp" db:"timestamp"`
}
```

### Validation Rules
- `AgentID`: MUST NOT be empty.
- `Level`: MUST be one of (INFO, WARNING, ERROR). Default to INFO if not specified.
- `Content`: MUST NOT be empty.
- `Timestamp`: Automatically assigned by the backend upon receipt.

### State Transitions
- **Received**: Message enters the system via `POST /api/messages`.
- **Persisted**: Message is successfully written to the SQLite `messages` table.
- **Broadcasted**: Message is available for retrieval via `GET /api/messages`.
