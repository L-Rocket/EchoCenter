# Storage-Custodian

## Overview

Storage-Custodian is the storage management agent of EchoCenter, responsible for monitoring and managing the storage system. It is a Python agent that communicates with the backend via WebSocket.

## Features

### 1. Storage Monitoring

Storage-Custodian monitors files and disk space in the storage directory:

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

### 2. System Log

Storage-Custodian periodically sends system logs:

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

### 3. Respond to Instructions

Storage-Custodian supports two response paths:
- Butler-originated request: send one final `CHAT`.
- User-originated request: send `CHAT_STREAM` chunks, then final `CHAT` (same `stream_id`) for persistence, then `CHAT_STREAM_END`.

```python
async def handle_command(command):
    if command.startswith("get_status"):
        stats = get_storage_stats()
        return f"Storage Status: {stats['total_files']} files, {stats['total_size']} bytes"
    elif command.startswith("list_files"):
        # List files
        pass
    elif command.startswith("get_file"):
        # Get file
        pass
```

## Configuration

### Environment Variables

```env
# Butler Configuration (Storage-Custodian uses the same Butler configuration)
BUTLER_BASE_URL=https://api.siliconflow.cn/v1
BUTLER_API_TOKEN=your_api_token_here
BUTLER_MODEL=gpt-3.5-turbo
```

### Storage Directory

Storage-Custodian uses `mock_agents/hive_storage` as the storage directory:

```python
# Use a path relative to the script location
script_dir = os.path.dirname(os.path.abspath(__file__))
STORAGE_DIR = os.path.join(script_dir, "hive_storage")
if not os.path.exists(STORAGE_DIR):
    os.makedirs(STORAGE_DIR)
```

## Connection

### Connection Address

```python
import asyncio
import websockets
import json

ECHOCENTER_WS_URL = "ws://localhost:8080/api/ws"

async def agent_loop(api_token):
    uri = f"{ECHOCENTER_WS_URL}?token={api_token}"
    async with websockets.connect(uri) as ws:
        # Send system log
        stats = get_storage_stats()
        await ws.send(json.dumps({
            "type": "SYSTEM_LOG",
            "payload": {
                "level": "SUCCESS",
                "content": f"Storage-Custodian initialized. Monitoring {STORAGE_DIR}. {stats['total_files']} files detected."
            }
        }))
        
        # Receive messages
        async for message in ws:
            msg = json.loads(message)
            await handle_message(msg)
```

### Connection Flow

```
1. Start Storage-Custodian
   ↓
2. Connect to WebSocket server
   ↓
3. Validate API token
   ↓
4. Send system log
   ↓
5. Start receiving messages
```

## Message Processing

### System Log

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

### Respond to Instruction (Butler path)

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

### Respond to Instruction (User path with persistence)

```json
{
  "type": "CHAT_STREAM",
  "sender_id": 7,
  "sender_name": "Storage-Custodian",
  "sender_role": "AGENT",
  "target_id": 1,
  "stream_id": "stream_123",
  "payload": "partial chunk..."
}
```

```json
{
  "type": "CHAT",
  "sender_id": 7,
  "sender_name": "Storage-Custodian",
  "sender_role": "AGENT",
  "target_id": 1,
  "stream_id": "stream_123",
  "payload": "final full response for history persistence"
}
```

```json
{
  "type": "CHAT_STREAM_END",
  "sender_id": 7,
  "sender_name": "Storage-Custodian",
  "sender_role": "AGENT",
  "target_id": 1,
  "stream_id": "stream_123"
}
```

## Commands

### get_status
Get storage status:
```bash
get_status
```
Response:
```
Storage Status: 10 files, 102400 bytes
```

### list_files
List files:
```bash
list_files
```
Response:
```
Files:
- file1.txt (1024 bytes)
- file2.txt (2048 bytes)
```

### get_file
Get file:
```bash
get_file filename
```
Response:
```
File content...
```

## Example

### Start Storage-Custodian

```bash
cd backend
python3 mock_agents/storage_custodian.py
```

### Check Storage Status

```python
# Storage-Custodian sends system log automatically after startup
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

### Query Storage Status

Butler can send instructions:

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

Storage-Custodian responds:

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

## Best Practices

### 1. Error Handling

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

### 2. Logging

```python
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def handle_message(msg):
    logger.info(f"Received message: {msg}")
    # Process message
```

### 3. Status Monitoring

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

## Scalability

### Adding New Commands
1. Add command parsing in `handle_command`.
2. Implement command logic.
3. Return response.

### Adding New Features
1. Add new functions in `get_storage_stats`.
2. Update message handling.
3. Test functionality.

## Performance Optimization
- Asynchronous processing
- Connection pool
- Caching
- Concurrent processing

## Security
- API token validation
- Input validation
- Error handling

## Troubleshooting

### Connection Failed
Check:
1. Backend service is running.
2. WebSocket URL is correct.
3. API token is valid.

### Message Not Sent
Check:
1. WebSocket connection is normal.
2. Message format is correct.
3. Network is normal.

### Storage Directory Does Not Exist
Storage-Custodian will automatically create the storage directory:

```python
if not os.path.exists(STORAGE_DIR):
    os.makedirs(STORAGE_DIR)
```
