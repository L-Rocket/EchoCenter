---
outline: deep
---

# WebSocket Communication

## Connection

```text
ws://localhost:8080/api/ws?token=<jwt_token>
```

- `token` is required.
- The backend authenticates JWT before registering the client.

## Message Envelope

```json
{
  "id": 123,
  "local_id": "uuid",
  "type": "CHAT",
  "sender_id": 1,
  "sender_name": "admin",
  "sender_role": "ADMIN",
  "target_id": 7,
  "payload": "hello",
  "timestamp": "2026-03-05T21:42:08Z",
  "stream_id": "stream_abc"
}
```

## Server-supported Types

- `SYSTEM_LOG`
- `CHAT`
- `CHAT_STREAM`
- `CHAT_STREAM_END`
- `AUTH_REQUEST`
- `AUTH_RESPONSE`
- `AUTH_STATUS_UPDATE`
- `BUTLER_AGENT_MESSAGE` (monitor event)

## Routing Rules

### Targeted Delivery

If `target_id` is set, the hub routes to that specific client.

### Sender Echo for `CHAT*`

For `CHAT`, `CHAT_STREAM`, `CHAT_STREAM_END`, sender echo is enabled only for human senders.

- Echo enabled: `ADMIN`, `MEMBER` (or other human roles)
- Echo disabled: `AGENT`, `BUTLER`

This prevents agent self-loop recursion.

### Broadcast

If `target_id` is missing/zero, message is broadcast to all connected clients.

## Butler-Agent Monitor Events

Backend emits `BUTLER_AGENT_MESSAGE` when Butler and an agent exchange `CHAT`.

- Event payload includes `agent_id`, `sender_role`, `payload`, `timestamp`.
- Events are targeted to authorized recipients (admin users), not broadcast globally.

## Agent Implementation Notes

### Recommended Reply Pattern

When handling user-originated requests:
1. send `CHAT_STREAM` chunks
2. send final `CHAT` with the same `stream_id` (for persistence)
3. send `CHAT_STREAM_END`

When handling Butler-originated requests, a single final `CHAT` is acceptable.

### Python Skeleton

```python
import asyncio
import json
import websockets

async def agent_loop(token: str):
    uri = f"ws://localhost:8080/api/ws?token={token}"
    async with websockets.connect(uri) as ws:
        async for raw in ws:
            msg = json.loads(raw)
            if msg.get("type") != "CHAT":
                continue
            sender_id = msg["sender_id"]
            stream_id = msg.get("stream_id", "stream_fallback")
            await ws.send(json.dumps({
                "type": "CHAT",
                "target_id": sender_id,
                "stream_id": stream_id,
                "payload": "done"
            }))
```
