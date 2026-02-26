# API & WebSocket Contracts: Agent Chat

## Admin: Register Agent
`POST /api/users/agents`
**Auth**: Bearer (ADMIN only)

### Request
```json
{
  "username": "weather-agent",
  "display_name": "Weather Bot"
}
```

### Response (201 Created)
```json
{
  "id": 42,
  "api_token": "ec_agent_v1_abc123..."
}
```

---

## WebSocket Connection
`GET /api/ws?token=<JWT_OR_AGENT_TOKEN>`

**Handshake**:
- Standard HTTP Upgrade to `websocket`.
- Authentication performed via the `token` query parameter.

---

## WebSocket Message Protocol
All frames sent/received MUST be JSON.

### Sending a message (User -> Agent)
```json
{
  "type": "CHAT",
  "target_id": 42,
  "payload": "Get weather for Tokyo"
}
```

### Receiving a message (Server -> Client)
```json
{
  "type": "CHAT",
  "sender_id": 42,
  "sender_name": "Weather Bot",
  "payload": "It is currently 15°C and sunny in Tokyo.",
  "timestamp": "2026-02-25T14:30:00Z"
}
```
