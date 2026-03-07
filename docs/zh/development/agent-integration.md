# Agent 接入指南

本指南将说明如何将你的原生应用或外部服务作为功能性 Agent 接入 EchoCenter。

## 1. 身份验证
每个 Agent 必须拥有唯一的 `api_token`。

- **现有 Agent**：
  - 在本地 mock 模式下，可用管理员开发接口获取：
    `GET /api/dev/mock/agent-token/:username`（仅非生产环境）。
  - 或使用你熟悉的数据库工具直接查底层存储。
  - 若使用 PostgreSQL，请在 `users`/`machine_credentials` 中查询对应字段。
- **新 Agent**: 通过管理员 API 注册：
  `POST /api/users/agents`，提交 `{"username": "你的应用名称"}`。
- **安全说明**：`GET /api/users/agents` 不会返回明文 `api_token`，只返回 `token_hint`。

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

为了兼顾流式体验与持久化，面向用户回复建议采用：
1. 多条 `CHAT_STREAM` 分片
2. 一条同 `stream_id` 的最终 `CHAT`
3. 一条 `CHAT_STREAM_END`

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
