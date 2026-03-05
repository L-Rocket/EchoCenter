---
outline: deep
---

# WebSocket 通信

## 连接方式

```text
ws://localhost:8080/api/ws?token=<jwt_token>
```

- `token` 必填。
- 后端会先校验 JWT，再注册连接。

## 消息包结构

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

## 后端支持的消息类型

- `SYSTEM_LOG`
- `CHAT`
- `CHAT_STREAM`
- `CHAT_STREAM_END`
- `AUTH_REQUEST`
- `AUTH_RESPONSE`
- `AUTH_STATUS_UPDATE`
- `BUTLER_AGENT_MESSAGE`（监控事件）

## 路由规则

### 定向投递

当 `target_id` 存在时，Hub 只路由给该目标连接。

### `CHAT*` 发送者回声规则

`CHAT` / `CHAT_STREAM` / `CHAT_STREAM_END` 仅对“人类发送者”回声。

- 会回声：`ADMIN`、`MEMBER` 等人类角色
- 不回声：`AGENT`、`BUTLER`

这样可避免 agent 收到自己回声后产生递归循环。

### 广播

若 `target_id` 为空或 0，则广播给所有已连接客户端。

## Butler-Agent 监控事件

当 Butler 与 Agent 发生 `CHAT` 往来时，后端会发出 `BUTLER_AGENT_MESSAGE`。

- 事件 payload 含 `agent_id`、`sender_role`、`payload`、`timestamp`。
- 事件会定向给有权限的接收者（管理员），不会全量广播。

## Agent 端实现建议

### 推荐回复模式

处理“用户直连”请求时：
1. 发送 `CHAT_STREAM` 分片
2. 发送同 `stream_id` 的最终 `CHAT`（用于持久化）
3. 发送 `CHAT_STREAM_END`

处理 Butler 请求时，可只发送一次最终 `CHAT`。

### Python 最小示例

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
