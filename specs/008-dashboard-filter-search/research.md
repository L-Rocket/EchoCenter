# Research: Dashboard Filtering and Search

## Decisions

### Decision: React Debounce Strategy
- **Decision**: Implement a custom `useDebounce` hook.
- **Rationale**: Simple, zero-dependency, and reusable for other search inputs. It ensures that the backend API is only hit once the user stops typing for 500ms.
- **Implementation**: Wrap the `searchTerm` state in the hook before passing it to the `useEffect` that triggers the API call.

### Decision: Dynamic SQL in Go
- **Decision**: Use a flexible string-builder pattern with parameter slice.
- **Rationale**: Avoids complex ORM dependencies while maintaining readability and safety against SQL injection.
- **Implementation**: Start with `SELECT ... FROM messages WHERE 1=1` and append `AND agent_id = ?` etc., conditionally.

### Decision: Real-time vs. Filtering Interaction
- **Decision**: Pause WebSocket UI prepending when active filters or search terms are present.
- **Rationale**: If a user is searching for a specific historical error, prepending new INFO logs from other agents would be confusing and disruptive (SC-003).
- **Behavior**: When filters are cleared, the UI will reload the most recent "Live" set.

## Best Practices

### Pagination
- Use `offset` and `limit`. While `keyset pagination` (cursor-based) is better for performance on massive datasets, `offset` is perfectly fine for EchoCenter's current scale and much easier to implement for complex filtering.

### Backend Search
- Use `LOWER(content) LIKE LOWER(?)` for case-insensitive search in the current storage layer.
- Ensure `idx_messages_timestamp` is still utilized by keeping `ORDER BY timestamp DESC` consistent.
