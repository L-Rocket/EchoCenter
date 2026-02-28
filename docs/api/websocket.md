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
  "sender_id": 7,
  "sender_name": "Storage-Custodian",
  "sender_role": "AGENT",
  "payload": {
    "level": "SUCCESS",
    "content": "Storage-Custodian initialized. Monitoring /path/to/hive_storage. 10 files detected."
  }
}
```

**字段**：
- `type` - 消息类型
- `sender_id` - 发送者 ID
- `sender_name` - 发送者名称
- `sender_role` - 发送者角色 (AGENT/BUTLER)
- `payload` - 日志数据
  - `level` - 日志级别 (INFO/WARNING/ERROR/SUCCESS)
  - `content` - 日志内容

### 2. CHAT

聊天消息：

```json
{
  "type": "CHAT",
  "sender_id": 2,
  "sender_name": "Butler",
  "sender_role": "BUTLER",
  "target_id": 1,
  "payload": "Hello, how can I help you?",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

**字段**：
- `type` - 消息类型
- `sender_id` - 发送者 ID
- `sender_name` - 发送者名称
- `sender_role` - 发送者角色
- `target_id` - 接收者 ID
- `payload` - 消息内容
- `timestamp` - 时间戳

### 3. CHAT_STREAM

流式聊天消息：

```json
{
  "type": "CHAT_STREAM",
  "sender_id": 2,
  "sender_name": "Butler",
  "sender_role": "BUTLER",
  "target_id": 1,
  "payload": "Processing your request...",
  "stream_id": "abc123"
}
```

**字段**：
- `type` - 消息类型
- `sender_id` - 发送者 ID
- `sender_name` - 发送者名称
- `sender_role` - 发送者角色
- `target_id` - 接收者 ID
- `payload` - 流内容
- `stream_id` - 流 ID

### 4. CHAT_STREAM_END

流结束消息：

```json
{
  "type": "CHAT_STREAM_END",
  "sender_id": 2,
  "sender_name": "Butler",
  "sender_role": "BUTLER",
  "target_id": 1,
  "payload": "",
  "stream_id": "abc123"
}
```

**字段**：
- `type` - 消息类型
- `sender_id` - 发送者 ID
- `sender_name` - 发送者名称
- `sender_role` - 发送者角色
- `target_id` - 接收者 ID
- `payload` - 空字符串
- `stream_id` - 流 ID

## 通信模式

### 1. 代理注册

```json
// 代理连接后发送
{
  "type": "SYSTEM_LOG",
  "sender_id": 7,
  "sender_name": "Storage-Custodian",
  "sender_role": "AGENT",
  "payload": {
    "level": "SUCCESS",
    "content": "Storage-Custodian initialized."
  }
}
```

### 2. 用户消息

```json
// 用户发送消息
{
  "type": "CHAT",
  "sender_id": 1,
  "sender_name": "Admin",
  "sender_role": "ADMIN",
  "target_id": 2,
  "payload": "Check the status of agent 7",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### 3. Butler 响应

```json
// Butler 处理消息
{
  "type": "CHAT",
  "sender_id": 2,
  "sender_name": "Butler",
  "sender_role": "BUTLER",
  "target_id": 1,
  "payload": "I'll check the status of agent 7.",
  "timestamp": "2024-01-01T00:00:01Z"
}
```

### 4. 授权请求

```json
// Butler 发送授权请求
{
  "type": "AUTH_REQUEST",
  "action_id": "cmd_123",
  "sender_id": 2,
  "sender_name": "Butler",
  "sender_role": "BUTLER",
  "target_id": 1,
  "command": "get_status 7",
  "reasoning": "User requested to check agent status",
  "timestamp": "2024-01-01T00:00:02Z"
}
```

### 5. 授权响应

```json
// 管理员批准/拒绝
{
  "type": "AUTH_RESPONSE",
  "action_id": "cmd_123",
  "approved": true,
  "sender_id": 1,
  "sender_name": "Admin",
  "sender_role": "ADMIN",
  "target_id": 2,
  "timestamp": "2024-01-01T00:00:03Z"
}
```

### 6. 命令执行

```json
// Butler 执行命令
{
  "type": "CHAT_STREAM",
  "sender_id": 2,
  "sender_name": "Butler",
  "sender_role": "BUTLER",
  "target_id": 1,
  "payload": "Checking status...",
  "stream_id": "cmd_123"
}

{
  "type": "CHAT_STREAM",
  "sender_id": 2,
  "sender_name": "Butler",
  "sender_role": "BUTLER",
  "target_id": 1,
  "payload": "Agent 7: Online",
  "stream_id": "cmd_123"
}

{
  "type": "CHAT_STREAM_END",
  "sender_id": 2,
  "sender_name": "Butler",
  "sender_role": "BUTLER",
  "target_id": 1,
  "payload": "",
  "stream_id": "cmd_123"
}
```

## 心跳

### Ping/Pong

WebSocket 实现了自动心跳检测：

```go
// 发送 ping
writeWait = 10 * time.Second

// 期望 pong
pongWait = 60 * time.Second

// 发送 ping 的周期
pingPeriod = (pongWait * 9) / 10
```

## 错误处理

### 认证错误

```json
{
  "error": "invalid token"
}
```

### 连接错误

```json
{
  "error": "connection failed"
}
```

### 消息格式错误

```json
{
  "error": "invalid message format"
}
```

## 最佳实践

### 1. 重新连接

```javascript
const reconnect = async () => {
  try {
    await connectWebSocket();
  } catch (error) {
    setTimeout(reconnect, 5000);
  }
};
```

### 2. 消息队列

```javascript
let messageQueue = [];

const sendMessage = (msg) => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  } else {
    messageQueue.push(msg);
  }
};
```

### 3. 流式处理

```javascript
let currentStream = null;

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  
  if (msg.type === 'CHAT_STREAM') {
    if (currentStream !== msg.stream_id) {
      currentStream = msg.stream_id;
      console.log('New stream:', msg.payload);
    } else {
      console.log(msg.payload);
    }
  } else if (msg.type === 'CHAT_STREAM_END') {
    currentStream = null;
  }
};
```

## 示例

### JavaScript 示例

```javascript
const token = localStorage.getItem('token');
const ws = new WebSocket(`ws://localhost:8080/api/ws?token=${token}`);

ws.onopen = () => {
  console.log('Connected to WebSocket');
};

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  
  switch (msg.type) {
    case 'SYSTEM_LOG':
      console.log('System log:', msg.payload);
      break;
    case 'CHAT':
      console.log('Chat:', msg.payload);
      break;
    case 'CHAT_STREAM':
      processStream(msg);
      break;
    case 'CHAT_STREAM_END':
      endStream(msg);
      break;
  }
};

ws.onclose = () => {
  console.log('Disconnected, reconnecting...');
  setTimeout(() => connect(), 5000);
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};
```

### Python 示例

```python
import asyncio
import websockets
import json

async def connect():
    token = get_token()
    uri = f"ws://localhost:8080/api/ws?token={token}"
    
    async with websockets.connect(uri) as ws:
        # 发送系统日志
        await ws.send(json.dumps({
            "type": "SYSTEM_LOG",
            "sender_id": 7,
            "sender_name": "Storage-Custodian",
            "sender_role": "AGENT",
            "payload": {
                "level": "SUCCESS",
                "content": "Connected successfully"
            }
        }))
        
        # 接收消息
        async for message in ws:
            msg = json.loads(message)
            print(f"Received: {msg}")

asyncio.run(connect())
```

### Go 示例

```go
package main

import (
    "log"
    "net/url"
    "github.com/gorilla/websocket"
)

func main() {
    token := "your_token"
    u := url.URL{
        Scheme: "ws",
        Host:   "localhost:8080",
        Path:   "/api/ws",
        RawQuery: "token=" + token,
    }
    
    conn, _, err := websocket.DefaultDialer.Dial(u.String(), nil)
    if err != nil {
        log.Fatal("Dial error:", err)
    }
    defer conn.Close()
    
    // 发送消息
    err = conn.WriteJSON(map[string]interface{}{
        "type": "SYSTEM_LOG",
        "sender_id": 7,
        "sender_name": "Storage-Custodian",
        "sender_role": "AGENT",
        "payload": map[string]string{
            "level":   "SUCCESS",
            "content": "Connected",
        },
    })
    if err != nil {
        log.Fatal("Write error:", err)
    }
    
    // 接收消息
    var msg map[string]interface{}
    err = conn.ReadJSON(&msg)
    if err != nil {
        log.Fatal("Read error:", err)
    }
    
    log.Println("Received:", msg)
}
```
