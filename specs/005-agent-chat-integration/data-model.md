# Data Model: Agent Chat Integration

## Entity: Agent (Persistent)
Specialized user account for automated systems.

### Attributes (Table `users` extension)
| Field | Type | Description |
|-------|------|-------------|
| `api_token` | TEXT | Unique long-lived token for Agent authentication. |
| `role` | TEXT | Set to 'AGENT' for these entities. |

## Entity: WebSocketMessage (Volatile)
In-memory structure for real-time exchange.

### Attributes
| Field | Type | Description |
|-------|------|-------------|
| `type` | TEXT | 'CHAT' or 'SYSTEM' |
| `sender_id` | INTEGER | User ID of the sender. |
| `sender_name` | TEXT | Display name of the sender. |
| `target_id` | INTEGER | User ID of the recipient. |
| `payload` | TEXT | The message content. |
| `timestamp` | DATETIME | ISO8601 string. |

### Logic Rules
- **Attribution**: Messages from an agent MUST use the name associated with their `api_token`.
- **Volatility**: These messages are broadcasted via the WebSocket Hub and stored in the Frontend's Zustand store only. They are NOT written to persistent storage.
