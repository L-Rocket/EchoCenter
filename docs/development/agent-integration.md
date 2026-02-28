# Agent Integration Guide

This guide explains how to connect your native application or external service to EchoCenter as a functional Agent.

## 1. Authentication
Every Agent must have a unique `api_token`.

- **Existing Agents**: If you used the mock seeder, check tokens in the database:
  ```bash
  sqlite3 backend/echocenter.db "SELECT username, api_token FROM users WHERE role = 'AGENT';"
  ```
- **New Agents**: Register via the Admin API:
  `POST /api/users/agents` with `{"username": "Your-Agent-Name"}`.

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
