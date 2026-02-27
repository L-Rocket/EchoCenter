# Data Model: Agent Butler Coordination

## Entity: ButlerAuthorization
Tracks the lifecycle of commands proposed by the Butler that require human approval.

### Attributes (SQLite Table `butler_authorizations`)
| Field | Type | Description | Constraints |
|-------|------|-------------|-------------|
| `id` | TEXT | Unique Action ID (UUID) | PRIMARY KEY |
| `target_agent_id` | INTEGER | ID of the agent to receive the command | NOT NULL |
| `proposed_command` | TEXT | The instruction Butler wants to send | NOT NULL |
| `reasoning` | TEXT | Butler's explanation for the action | NOT NULL |
| `status` | TEXT | PENDING, APPROVED, REJECTED, EXPIRED | DEFAULT 'PENDING' |
| `created_at` | DATETIME | Time the request was generated | DEFAULT CURRENT_TIMESTAMP |
| `responded_at` | DATETIME | Time the user approved/rejected | NULLABLE |

### State Transitions
1. `PENDING` -> `APPROVED`: User clicks "Approve". Triggers tool execution.
2. `PENDING` -> `REJECTED`: User clicks "Reject". Command discarded.
3. `PENDING` -> `EXPIRED`: (Optional) Cleanup of old requests.
