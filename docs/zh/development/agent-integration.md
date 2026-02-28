# Agent 接入指南

本指南将说明如何将你的原生应用或外部服务作为功能性 Agent 接入 EchoCenter。

## 1. 身份验证
每个 Agent 必须拥有唯一的 `api_token`。

- **现有 Agent**: 如果你使用了 Mock 数据种子，可以从数据库中查询 Token：
  ```bash
  sqlite3 backend/echocenter.db "SELECT username, api_token FROM users WHERE role = 'AGENT';"
  ```
- **新 Agent**: 通过管理员 API 注册：
  `POST /api/users/agents`，提交 `{"username": "你的应用名称"}`。

## 2. 建立连接
通过 WebSocket 连接到以下地址：
- **URL**: `ws://<host>:8080/api/ws?token=<你的_AGENT_TOKEN>`

## 3. 通信协议
所有通信均采用 JSON 格式。

### A. 发送状态日志 (更新大盘)
用于汇报后台活动或健康状态。
```json
{
  "type": "SYSTEM_LOG",
  "payload": {
    "level": "INFO", // 可选: INFO, WARNING, ERROR, SUCCESS
    "content": "正在处理第 42 批次任务..."
  }
}
```

### B. 接收指令 (来自用户或 Butler)
监听 `type` 为 `CHAT` 的消息。
```json
{
  "type": "CHAT",
  "sender_id": 1,
  "sender_name": "admin",
  "payload": "请执行系统扫描"
}
```

### C. 回复指令
向 `sender_id` (对应的 `target_id`) 发送 `CHAT` 消息。
```json
{
  "type": "CHAT",
  "target_id": 1,
  "payload": "扫描完成，未发现威胁。"
}
```

## 4. 代码示例 (Python)
```python
import websocket
import json

token = "your_token_here"
ws = websocket.create_connection(f"ws://localhost:8080/api/ws?token={token}")

# 发送日志
ws.send(json.dumps({
    "type": "SYSTEM_LOG",
    "payload": {"level": "SUCCESS", "content": "Agent Online"}
}))

# 监听并回复
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
