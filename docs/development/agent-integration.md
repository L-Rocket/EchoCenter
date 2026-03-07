# Agent Integration Guide

This guide explains how to connect your native application or external service to EchoCenter as a functional Agent.

## 1. Authentication
Every Agent must have a unique `api_token`.

- **Existing Agents**:
  - In local mock mode, use admin dev endpoint:
    `GET /api/dev/mock/agent-token/:username` (non-production only).
  - Or query the backing store directly with your preferred database tool.
  - If using PostgreSQL, query the same fields from `users`/`machine_credentials`.
- **New Agents**: Register via the Admin API:
  `POST /api/users/agents` with `{"username": "Your-Agent-Name"}`.
- **Security Note**: `GET /api/users/agents` does not return raw `api_token`; it returns `token_hint` only.

## 2. Connection
Connect via WebSocket to the following endpoint:
- **URL**: `ws://<host>:8080/api/ws?token=<YOUR_AGENT_TOKEN>`

## 3. Message Protocol
All communication is done via JSON.

### A. Sending Status Logs (To Dashboard)
Use this to report background activities or health status.
```json
{
  "type": "SYSTEM_LOG",
  "payload": {
    "level": "INFO", // INFO, WARNING, ERROR, SUCCESS
    "content": "Processing task batch #42..."
  }
}
```

### B. Receiving Instructions (From User/Butler)
Listen for messages where `type` is `CHAT`.
```json
{
  "type": "CHAT",
  "sender_id": 1,
  "sender_name": "admin",
  "payload": "Please execute system scan."
}
```

### C. Replying to Instructions
Send a `CHAT` message back to the `sender_id` (target_id).
```json
{
  "type": "CHAT",
  "target_id": 1,
  "payload": "Scan complete. No threats detected."
}
```

For streaming UX and persistence, recommended for user-facing replies:
1. multiple `CHAT_STREAM` chunks
2. one final `CHAT` with the same `stream_id`
3. `CHAT_STREAM_END`

## 4. Code Example (Python)
```python
import websocket
import json

token = "your_token_here"
ws = websocket.create_connection(f"ws://localhost:8080/api/ws?token={token}")

# Send a log
ws.send(json.dumps({
    "type": "SYSTEM_LOG",
    "payload": {"level": "SUCCESS", "content": "Agent Online"}
}))

# Listen and reply
while True:
    msg = json.loads(ws.recv())
    if msg["type"] == "CHAT":
        print(f"Received: {msg['payload']}")
        ws.send(json.dumps({
            "type": "CHAT",
            "target_id": msg["sender_id"],
            "payload": "Roger that!"
        }))
```
