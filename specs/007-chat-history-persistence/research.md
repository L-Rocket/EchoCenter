# Research: Chat History Persistence

## Decisions

### Decision: Async Database Writes
- **Decision**: Use a non-blocking goroutine to write WebSocket messages to SQLite.
- **Rationale**: WebSocket message broadcasting should be as low-latency as possible (SC-002). Blocking the Hub's main loop for database I/O could cause delays in high-traffic scenarios.
- **Implementation**: The Hub will trigger a `go database.SaveChatMessage(...)` for every 'CHAT' type message.

### Decision: Message De-duplication Strategy
- **Decision**: Use a combination of `timestamp` and `id` check in the frontend Zustand store.
- **Rationale**: There is a race condition where a message might arrive via WebSocket while the history API is still loading. 
- **Implementation**: `useChatStore` will check if a message with the same content/sender/timestamp already exists before adding it during history hydration.

### Decision: Database Schema Optimization
- **Decision**: Add a composite index on `(sender_id, receiver_id, timestamp)`.
- **Rationale**: Ensures the `GET /api/chat/history` query remains under the 300ms performance goal (SC-001) as the database grows.

## Best Practices

### Data Integrity
- Use database transactions where appropriate if multiple tables ever need updating, though for MVP, a single table insert is atomic in SQLite.

### Frontend Hydration
- Ensure the "Awaiting Transmission" state is only shown after the history API has returned an empty result, preventing a "flicker" of empty state during loading.
