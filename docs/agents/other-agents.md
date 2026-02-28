# 其他代理

## 概述

EchoCenter 支持多个代理，每个代理负责特定的功能。

## 代理列表

### 1. Weather-Sentinel

**角色**：天气监控代理

**功能**：
- 监控天气数据
- 发送天气报告
- 分析天气趋势

**配置**：
```env
WEATHER_API_KEY=your_weather_api_key
WEATHER_LOCATION=Beijing
```

**消息类型**：
- `SYSTEM_LOG` - 天气报告
- `WEATHER_UPDATE` - 天气更新

### 2. Code-Reviewer-AI

**角色**：代码审查代理

**功能**：
- 审查代码
- 发现潜在问题
- 提供改进建议

**配置**：
```env
CODE_REVIEW_API_KEY=your_api_key
```

**消息类型**：
- `SYSTEM_LOG` - 审查报告
- `CODE_REVIEW` - 代码审查

### 3. Security-Audit-Bot

**角色**：安全审计代理

**功能**：
- 审计系统安全
- 发现安全漏洞
- 发送安全报告

**配置**：
```env
SECURITY_API_KEY=your_api_key
```

**消息类型**：
- `SYSTEM_LOG` - 安全报告
- `SECURITY_ALERT` - 安全警报

### 4. Echo-Bot

**角色**：回显代理

**功能**：
- 回显用户消息
- 测试通信
- 调试工具

**配置**：
无特殊配置

**消息类型**：
- `SYSTEM_LOG` - 连接状态
- `CHAT` - 回显消息

## 代理注册

### 通过 API 注册

```bash
curl -X POST http://localhost:8080/api/users/agents \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username": "Weather-Sentinel"}'
```

### 通过脚本注册

```bash
cd backend/scripts
./seed_mock_data.sh
```

## 代理通信

### 代理间通信

代理之间可以通过 Butler 进行通信：

```json
{
  "type": "CHAT",
  "sender_id": 3,
  "sender_name": "Weather-Sentinel",
  "sender_role": "AGENT",
  "target_id": 2,
  "payload": "Check the status of agent 7",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### 广播消息

代理可以发送广播消息：

```json
{
  "type": "CHAT",
  "sender_id": 3,
  "sender_name": "Weather-Sentinel",
  "sender_role": "AGENT",
  "payload": "Weather update: Sunny",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

## 代理管理

### 获取代理列表

```bash
curl -X GET http://localhost:8080/api/users/agents \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 删除代理

```bash
curl -X DELETE http://localhost:8080/api/users/agents/7 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 最佳实践

### 1. 代理命名

使用有意义的名称：

```
Weather-Sentinel
Code-Reviewer-AI
Security-Audit-Bot
Echo-Bot
```

### 2. 代理角色

明确代理的角色：

- `AGENT` - 普通代理
- `BUTLER` - 核心代理

### 3. 代理通信

使用 Butler 进行代理间通信：

```
代理 → Butler → 代理
```

## 示例

### 创建新代理

1. 创建 Python 脚本

```python
import asyncio
import websockets
import json

async def new_agent_loop(api_token):
    uri = "ws://localhost:8080/api/ws?token=" + api_token
    async with websockets.connect(uri) as ws:
        # 发送系统日志
        await ws.send(json.dumps({
            "type": "SYSTEM_LOG",
            "sender_id": 8,
            "sender_name": "New-Agent",
            "sender_role": "AGENT",
            "payload": {
                "level": "SUCCESS",
                "content": "New-Agent initialized."
            }
        }))
        
        # 接收消息
        async for message in ws:
            msg = json.loads(message)
            await handle_message(msg)
```

2. 注册代理

```bash
curl -X POST http://localhost:8080/api/users/agents \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username": "New-Agent"}'
```

3. 启动代理

```bash
python3 mock_agents/new_agent.py
```

## 故障排除

### 代理未连接

检查：
1. 代理脚本是否正确
2. API 令牌是否有效
3. 网络是否正常

### 代理未响应

检查：
1. WebSocket 连接是否正常
2. 消息处理逻辑是否正确
3. 是否有错误日志

### 代理注册失败

检查：
1. API 令牌是否有权限
2. 代理名称是否唯一
3. 数据库是否正常
