---
outline: deep
---

# WebSocket 通信

## 概述

EchoCenter 使用 WebSocket 进行实时双向通信。所有代理和前端都通过 WebSocket 连接到后端。

## 连接

### 连接地址

```
ws://localhost:8080/api/ws?token=your_jwt_token
```

### 连接参数

- `token` - JWT 令牌（必需）

### 连接流程

```
1. 客户端连接到 WebSocket 服务器
2. 服务器验证 JWT 令牌
3. 服务器注册客户端
4. 客户端开始发送/接收消息
```

## 消息类型

### 1. SYSTEM_LOG

系统日志消息：

```json
{
  "type": "SYSTEM_LOG",
  "sender_id": 1,
  "sender_name": "admin",
  "sender_role": "ADMIN",
  "payload": {
    "level": "SUCCESS",
    "content": "System initialized"
  }
}
```

### 2. CHAT

聊天消息：

```json
{
  "type": "CHAT",
  "sender_id": 1,
  "sender_name": "admin",
  "sender_role": "ADMIN",
  "target_id": 2,
  "payload": "Hello, Butler!",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### 3. AUTH_REQUEST

授权请求：

```json
{
  "type": "AUTH_REQUEST",
  "sender_id": 2,
  "sender_name": "Butler",
  "sender_role": "BUTLER",
  "target_id": 1,
  "payload": {
    "action_id": "cmd_123",
    "command": "ls -la",
    "description": "List files in current directory"
  }
}
```

### 4. AUTH_RESPONSE

授权响应：

```json
{
  "type": "AUTH_RESPONSE",
  "sender_id": 1,
  "sender_name": "admin",
  "sender_role": "ADMIN",
  "target_id": 2,
  "payload": {
    "action_id": "cmd_123",
    "approved": true,
    "message": "Approved by admin"
  }
}
```

### 5. AGENT_RESPONSE

代理响应：

```json
{
  "type": "AGENT_RESPONSE",
  "sender_id": 7,
  "sender_name": "Storage-Custodian",
  "sender_role": "AGENT",
  "target_id": 2,
  "payload": {
    "action_id": "cmd_123",
    "stream_id": "stream_456",
    "response": "file1.txt\nfile2.txt",
    "is_complete": true
  }
}
```

## 消息格式

### 通用格式

```json
{
  "type": "MESSAGE_TYPE",
  "sender_id": 1,
  "sender_name": "sender_name",
  "sender_role": "ADMIN|BUTLER|AGENT",
  "target_id": 2,
  "payload": {},
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### 字段说明

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| type | string | 是 | 消息类型 |
| sender_id | integer | 是 | 发送者 ID |
| sender_name | string | 是 | 发送者名称 |
| sender_role | string | 是 | 发送者角色 |
| target_id | integer | 否 | 目标 ID |
| payload | object | 是 | 消息负载 |
| timestamp | string | 是 | 时间戳 |

## Hub 管理

### 连接管理

```go
type Hub struct {
    connections map[*Connection]bool
    register    chan *Connection
    unregister  chan *Connection
    messages    chan *Message
}
```

### 消息分发

```go
func (h *Hub) run() {
    for {
        select {
        case conn := <-h.register:
            h.connections[conn] = true
        case conn := <-h.unregister:
            if _, ok := h.connections[conn]; ok {
                delete(h.connections, conn)
                close(conn.send)
            }
        case msg := <-h.messages:
            for conn := range h.connections {
                select {
                case conn.send <- msg:
                default:
                    delete(h.connections, conn)
                    close(conn.send)
                }
            }
        }
    }
}
```

## 代理连接

### 连接示例

```python
import asyncio
import websockets
import json

async def agent_loop(api_token):
    uri = f"ws://localhost:8080/api/ws?token={api_token}"
    async with websockets.connect(uri) as ws:
        # 发送消息
        await ws.send(json.dumps({
            "type": "SYSTEM_LOG",
            "sender_id": 7,
            "sender_name": "Storage-Custodian",
            "sender_role": "AGENT",
            "payload": {
                "level": "SUCCESS",
                "content": "Agent connected"
            }
        }))
        
        # 接收消息
        async for message in ws:
            msg = json.loads(message)
            await handle_message(msg)
```

### 连接参数

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| token | string | 是 | JWT 令牌 |

## 前端连接

### 连接示例

```javascript
const token = localStorage.getItem('token')
const ws = new WebSocket(`ws://localhost:8080/api/ws?token=${token}`)

ws.onopen = () => {
  console.log('Connected to WebSocket')
}

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data)
  handleMessage(msg)
}

ws.onclose = () => {
  console.log('Disconnected from WebSocket')
}

ws.onerror = (error) => {
  console.error('WebSocket error:', error)
}
```

### 连接状态

- `CONNECTING` - 连接中
- `OPEN` - 已连接
- `CLOSING` - 关闭中
- `CLOSED` - 已关闭

## 消息处理

### 代理消息处理

```python
async def handle_message(msg):
    if msg["type"] == "CHAT":
        response = await process_command(msg["payload"])
        await ws.send(json.dumps({
            "type": "CHAT",
            "sender_id": 7,
            "sender_name": "Storage-Custodian",
            "sender_role": "AGENT",
            "target_id": msg["sender_id"],
            "payload": response,
            "timestamp": datetime.utcnow().isoformat()
        }))
```

### 前端消息处理

```javascript
function handleMessage(msg) {
  switch (msg.type) {
    case 'SYSTEM_LOG':
      console.log('System log:', msg.payload)
      break
    case 'CHAT':
      console.log('Chat message:', msg.payload)
      break
    case 'AUTH_REQUEST':
      console.log('Authorization request:', msg.payload)
      break
    case 'AUTH_RESPONSE':
      console.log('Authorization response:', msg.payload)
      break
    case 'AGENT_RESPONSE':
      console.log('Agent response:', msg.payload)
      break
  }
}
```

## 错误处理

### 连接错误

```json
{
  "type": "ERROR",
  "payload": {
    "code": "INVALID_TOKEN",
    "message": "Invalid JWT token"
  }
}
```

### 消息错误

```json
{
  "type": "ERROR",
  "payload": {
    "code": "INVALID_MESSAGE",
    "message": "Invalid message format"
  }
}
```

## 最佳实践

### 1. 连接管理

- 保持连接
- 重连机制
- 心跳检测

### 2. 消息处理

- 异步处理
- 错误处理
- 日志记录

### 3. 安全性

- 使用 HTTPS
- 令牌验证
- 输入验证

### 4. 性能

- 连接池
- 消息队列
- 并发处理
