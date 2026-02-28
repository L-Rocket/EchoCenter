# Storage-Custodian

## 概述

Storage-Custodian 是 EchoCenter 的存储管理代理，负责监控和管理存储系统。它是一个 Python 代理，通过 WebSocket 与后端通信。

## 功能特性

### 1. 存储监控

Storage-Custodian 监控存储目录的文件和磁盘空间：

```python
def get_storage_stats():
    files = []
    total_size = 0
    for f in os.listdir(STORAGE_DIR):
        fp = os.path.join(STORAGE_DIR, f)
        if os.path.isfile(fp):
            files.append({
                "name": os.path.basename(fp),
                "size": os.path.getsize(fp),
                "modified": datetime.fromtimestamp(os.path.getmtime(fp))
            })
            total_size += os.path.getsize(fp)
    
    return {
        "total_files": len(files),
        "total_size": total_size,
        "files": files
    }
```

### 2. 系统日志

Storage-Custodian 定期发送系统日志：

```python
stats = get_storage_stats()
await ws.send(json.dumps({
    "type": "SYSTEM_LOG",
    "payload": {
        "level": "SUCCESS",
        "content": f"Storage-Custodian initialized. Monitoring {STORAGE_DIR}. {stats['total_files']} files detected."
    }
}))
```

### 3. 响应指令

Storage-Custodian 可以响应 Butler 的指令：

```python
async def handle_command(command):
    if command.startswith("get_status"):
        stats = get_storage_stats()
        return f"Storage Status: {stats['total_files']} files, {stats['total_size']} bytes"
    elif command.startswith("list_files"):
        # 列出文件
        pass
    elif command.startswith("get_file"):
        # 获取文件
        pass
```

## 配置

### 环境变量

```env
# Butler 配置（Storage-Custodian 使用相同的 Butler 配置）
BUTLER_BASE_URL=https://api.siliconflow.cn/v1
BUTLER_API_TOKEN=your_api_token_here
BUTLER_MODEL=gpt-3.5-turbo
```

### 存储目录

Storage-Custodian 使用 `mock_agents/hive_storage` 作为存储目录：

```python
# Use a path relative to the script location
script_dir = os.path.dirname(os.path.abspath(__file__))
STORAGE_DIR = os.path.join(script_dir, "hive_storage")
if not os.path.exists(STORAGE_DIR):
    os.makedirs(STORAGE_DIR)
```

## 连接

### 连接地址

```python
import asyncio
import websockets
import json

ECHOCENTER_WS_URL = "ws://localhost:8080/api/ws"

async def agent_loop(api_token):
    uri = f"{ECHOCENTER_WS_URL}?token={api_token}"
    async with websockets.connect(uri) as ws:
        # 发送系统日志
        stats = get_storage_stats()
        await ws.send(json.dumps({
            "type": "SYSTEM_LOG",
            "payload": {
                "level": "SUCCESS",
                "content": f"Storage-Custodian initialized. Monitoring {STORAGE_DIR}. {stats['total_files']} files detected."
            }
        }))
        
        # 接收消息
        async for message in ws:
            msg = json.loads(message)
            await handle_message(msg)
```

### 连接流程

```
1. 启动 Storage-Custodian
   ↓
2. 连接到 WebSocket 服务器
   ↓
3. 验证 API 令牌
   ↓
4. 发送系统日志
   ↓
5. 开始接收消息
```

## 消息处理

### 系统日志

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

### 响应指令

```json
{
  "type": "CHAT",
  "sender_id": 7,
  "sender_name": "Storage-Custodian",
  "sender_role": "AGENT",
  "target_id": 2,
  "payload": "Storage Status: 10 files, 102400 bytes",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

## 命令

### get_status

获取存储状态：

```bash
get_status
```

响应：
```
Storage Status: 10 files, 102400 bytes
```

### list_files

列出文件：

```bash
list_files
```

响应：
```
Files:
- file1.txt (1024 bytes)
- file2.txt (2048 bytes)
```

### get_file

获取文件：

```bash
get_file filename
```

响应：
```
File content...
```

## 示例

### 启动 Storage-Custodian

```bash
cd backend
python3 mock_agents/storage_custodian.py
```

### 查看存储状态

```python
# Storage-Custodian 启动后自动发送系统日志
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

### 查询存储状态

Butler 可以发送指令：

```json
{
  "type": "CHAT",
  "sender_id": 2,
  "sender_name": "Butler",
  "sender_role": "BUTLER",
  "target_id": 7,
  "payload": "get_status",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

Storage-Custodian 响应：

```json
{
  "type": "CHAT",
  "sender_id": 7,
  "sender_name": "Storage-Custodian",
  "sender_role": "AGENT",
  "target_id": 2,
  "payload": "Storage Status: 10 files, 102400 bytes",
  "timestamp": "2024-01-01T00:00:01Z"
}
```

## 最佳实践

### 1. 错误处理

```python
async def handle_message(msg):
    try:
        if msg["type"] == "CHAT":
            response = await handle_command(msg["payload"])
            await ws.send(json.dumps({
                "type": "CHAT",
                "sender_id": 7,
                "sender_name": "Storage-Custodian",
                "sender_role": "AGENT",
                "target_id": msg["sender_id"],
                "payload": response,
                "timestamp": datetime.utcnow().isoformat()
            }))
    except Exception as e:
        log.error(f"Error handling message: {e}")
```

### 2. 日志记录

```python
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def handle_message(msg):
    logger.info(f"Received message: {msg}")
    # 处理消息
```

### 3. 状态监控

```python
def get_storage_stats():
    try:
        files = []
        total_size = 0
        for f in os.listdir(STORAGE_DIR):
            fp = os.path.join(STORAGE_DIR, f)
            if os.path.isfile(fp):
                files.append({
                    "name": os.path.basename(fp),
                    "size": os.path.getsize(fp),
                    "modified": datetime.fromtimestamp(os.path.getmtime(fp))
                })
                total_size += os.path.getsize(fp)
        
        return {
            "total_files": len(files),
            "total_size": total_size,
            "files": files
        }
    except Exception as e:
        logger.error(f"Error getting storage stats: {e}")
        return {"error": str(e)}
```

## 扩展性

### 添加新命令

1. 在 `handle_command` 中添加命令解析
2. 实现命令逻辑
3. 返回响应

### 添加新功能

1. 在 `get_storage_stats` 中添加新功能
2. 更新消息处理
3. 测试功能

## 性能优化

- 异步处理
- 连接池
- 缓存
- 并发处理

## 安全性

- API 令牌验证
- 输入验证
- 错误处理

## 故障排除

### 连接失败

检查：
1. 后端服务是否运行
2. WebSocket URL 是否正确
3. API 令牌是否有效

### 消息未发送

检查：
1. WebSocket 连接是否正常
2. 消息格式是否正确
3. 网络是否正常

### 存储目录不存在

Storage-Custodian 会自动创建存储目录：

```python
if not os.path.exists(STORAGE_DIR):
    os.makedirs(STORAGE_DIR)
```
