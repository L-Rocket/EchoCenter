# Research: Agent Chat Integration

## Decisions

### Decision: WebSocket Library - Gorilla WebSocket
- **Decision**: Use `github.com/gorilla/websocket`.
- **Rationale**: It is the most mature and widely-used WebSocket library in the Go ecosystem. It provides low-level control over connections, robust error handling, and easy integration with Gin.
- **Alternatives**: `nhooyr.io/websocket` (excellent but more minimalist; Gorilla is safer for a "popular tech" request).

### Decision: Frontend State Management - Zustand
- **Decision**: Use `zustand` for managing the volatile chat history.
- **Rationale**: Since the specification requires chat history to be **volatile** (cleared on refresh), Zustand is perfect. It is extremely lightweight, performant, and avoids the boilerplate of Redux while being more scalable than raw React `useState` for a chat history.
- **Implementation**: Create a `useChatStore` that holds messages keyed by Agent ID.

### Decision: WebSocket Authentication
- **Decision**: Pass the token via a query parameter during the initial handshake (e.g., `ws://.../ws?token=...`).
- **Rationale**: Standard WebSockets do not support custom headers in browser-based clients without significant workarounds. Query params are the most reliable way to authenticate agents and users during the `Upgrade` phase.
- **Security**: The token is verified against the database before the connection is accepted.

### Decision: Message Format - JSON
- **Decision**: All WebSocket frames will use structured JSON.
- **Structure**: 
  ```json
  {
    "type": "MESSAGE",
    "target_id": "agent_123",
    "payload": "Hello agent!",
    "timestamp": "..."
  }
  ```

## Best Practices

### WS Heartbeats (Ping/Pong)
- Implement ping/pong heartbeats to detect and close "zombie" connections, ensuring backend resource efficiency.

### UI Consistency (Shadcn/ui)
- Reuse the `Card`, `Badge`, and `ScrollArea` primitives from the UI/UX Optimization feature to ensure the Chat UI feels like a native part of EchoCenter.

### Error Feedback
- The UI MUST show clear visual feedback if the WebSocket connection is lost (e.g., a "Disconnected" banner or a grayed-out input field).
