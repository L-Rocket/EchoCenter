# Data Model: Chat History Persistence

## Entity: ChatMessage (Persistent)
Stores the bi-directional exchange between a User and an Agent.

### Attributes (SQLite Table `chat_messages`)
| Field | Type | Description | Constraints |
|-------|------|-------------|-------------|
| `id` | INTEGER | Primary Key | AUTOINCREMENT |
| `sender_id` | INTEGER | User ID of the message sender | NOT NULL, REFERENCES users(id) |
| `receiver_id` | INTEGER | User ID of the message recipient | NOT NULL, REFERENCES users(id) |
| `content` | TEXT | The message body | NOT NULL |
| `timestamp` | DATETIME | When the message was persisted | DEFAULT CURRENT_TIMESTAMP |

### Go Struct Mapping
```go
type ChatMessage struct {
	ID         int       `json:"id" db:"id"`
	SenderID   int       `json:"sender_id" db:"sender_id"`
	ReceiverID int       `json:"receiver_id" db:"receiver_id"`
	Content    string    `json:"content" db:"content"`
	Timestamp  time.Time `json:"timestamp" db:"timestamp"`
}
```

### Indexing
- `IDX_CHAT_PAIR_TIME`: `(sender_id, receiver_id, timestamp DESC)` - Optimized for retrieving the latest conversation between two parties.
