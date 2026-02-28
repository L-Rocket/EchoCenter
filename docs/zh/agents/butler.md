# Butler

## 概述

Butler 是 EchoCenter 的核心代理，负责协调其他代理和处理用户请求。它是一个 AI 驱动的代理，能够理解用户意图并执行复杂的任务。

## 功能特性

### 1. 消息处理

Butler 接收用户消息，分析意图，并决定如何响应。

```go
func (s *ButlerService) HandleUserMessage(ctx context.Context, senderID int, payload string) {
    // 分析消息
    response, err := s.brain.ChatStream(ctx, payload)
    
    // 发送响应
    s.hub.BroadcastGeneric(map[string]interface{}{
        "type":        "CHAT",
        "sender_id":   s.butlerID,
        "sender_name": s.butlerName,
        "sender_role": "BUTLER",
        "target_id":   senderID,
        "payload":     response,
    })
}
```

### 2. 命令执行

Butler 可以执行命令，包括：
- 查询系统状态
- 管理代理
- 执行操作

```go
func (s *ButlerService) ExecutePendingCommand(ctx context.Context, streamID string, senderID int, approved bool) {
    if !approved {
        // 用户拒绝命令
        s.hub.BroadcastGeneric(map[string]interface{}{
            "type":        "CHAT",
            "sender_id":   s.butlerID,
            "sender_name": s.butlerName,
            "sender_role": "BUTLER",
            "target_id":   senderID,
            "payload":     "Command cancelled by user.",
        })
        return
    }
    
    // 执行命令
    _, err := s.brain.ExecuteCommand(ctx, result, func(chunk string) error {
        // 流式返回
        s.hub.BroadcastGeneric(map[string]interface{}{
            "type":        "CHAT_STREAM",
            "sender_id":   s.butlerID,
            "sender_name": s.butlerName,
            "sender_role": "BUTLER",
            "target_id":   senderID,
            "payload":     chunk,
            "stream_id":   streamID,
        })
        return nil
    })
}
```

### 3. 授权请求

当需要执行敏感操作时，Butler 会发送授权请求。

```go
func (s *ButlerService) RequestAuthorization(actionID string, targetID int, command, reasoning string) {
    s.hub.BroadcastGeneric(map[string]interface{}{
        "type":        "AUTH_REQUEST",
        "action_id":   actionID,
        "sender_id":   s.butlerID,
        "sender_name": s.butlerName,
        "sender_role": "BUTLER",
        "target_id":   targetID,
        "command":     command,
        "reasoning":   reasoning,
    })
}
```

### 4. 代理协调

Butler 可以协调其他代理执行任务。

```go
func (s *ButlerService) ProcessLog(ctx context.Context, msg models.Message) {
    // 处理系统日志
    s.brain.ProcessLog(msg)
}
```

## 工作流程

### 用户请求流程

```
1. 用户发送消息给 Butler
   ↓
2. Butler 接收消息
   ↓
3. AI 大脑分析消息
   ↓
4. 决定响应方式
   ↓
5. 发送响应给用户
```

### 命令执行流程

```
1. Butler 检测到需要执行命令
   ↓
2. 发送授权请求给管理员
   ↓
3. 等待管理员批准/拒绝
   ↓
4. 如果批准，执行命令
   ↓
5. 流式返回结果给管理员
```

### 代理协调流程

```
1. Butler 需要代理执行任务
   ↓
2. 发送指令给代理
   ↓
3. 代理执行任务
   ↓
4. 代理返回结果
   ↓
5. Butler 处理结果
   ↓
6. 发送最终响应给用户
```

## 配置

### 环境变量

```env
# Butler AI 配置
BUTLER_BASE_URL=https://api.siliconflow.cn/v1
BUTLER_API_TOKEN=your_api_token_here
BUTLER_MODEL=gpt-3.5-turbo
```

### 配置说明

- `BUTLER_BASE_URL` - AI API 基础 URL
- `BUTLER_API_TOKEN` - AI API 令牌
- `BUTLER_MODEL` - AI 模型名称

## 消息类型

### CHAT

普通聊天消息：

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

### CHAT_STREAM

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

### CHAT_STREAM_END

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

### AUTH_REQUEST

授权请求：

```json
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

## AI 大脑

### EinoBrain

Butler 使用 Eino 作为 AI 大脑：

```go
type EinoBrain struct {
    baseURL    string
    apiToken   string
    model      string
}
```

**功能**：
- 调用 AI API
- 分析消息
- 生成响应
- 执行命令

### ChatStream

流式聊天：

```go
func (b *EinoBrain) ChatStream(ctx context.Context, prompt string) (string, error) {
    // 调用 AI API
    // 流式返回响应
}
```

### ExecuteCommand

执行命令：

```go
func (b *EinoBrain) ExecuteCommand(ctx context.Context, command string, callback func(string) error) error {
    // 解析命令
    // 执行命令
    // 流式返回结果
}
```

## 工具函数

### ExecuteCommandDirect

直接执行命令：

```go
func ExecuteCommandDirect(ctx context.Context, command string) (string, error) {
    // 执行命令
    // 返回结果
}
```

### RegisterAgentResponse

注册代理响应：

```go
func RegisterAgentResponse(agentID int, response string) error {
    // 注册响应
    // 通知等待的命令
}
```

## 最佳实践

### 1. 错误处理

```go
func (s *ButlerService) HandleUserMessage(ctx context.Context, senderID int, payload string) {
    response, err := s.brain.ChatStream(ctx, payload)
    if err != nil {
        log.Printf("Error processing message: %v", err)
        s.hub.BroadcastGeneric(map[string]interface{}{
            "type":        "CHAT",
            "sender_id":   s.butlerID,
            "sender_name": s.butlerName,
            "sender_role": "BUTLER",
            "target_id":   senderID,
            "payload":     "Sorry, I encountered an error processing your request.",
        })
        return
    }
    
    s.hub.BroadcastGeneric(map[string]interface{}{
        "type":        "CHAT",
        "sender_id":   s.butlerID,
        "sender_name": s.butlerName,
        "sender_role": "BUTLER",
        "target_id":   senderID,
        "payload":     response,
    })
}
```

### 2. 超时处理

```go
func (s *ButlerService) ExecutePendingCommand(ctx context.Context, streamID string, senderID int, approved bool) {
    ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
    defer cancel()
    
    // 执行命令
    _, err := s.brain.ExecuteCommand(ctx, result, func(chunk string) error {
        // ...
    })
    
    if err != nil {
        log.Printf("Command execution timeout: %v", err)
    }
}
```

### 3. 日志记录

```go
func (s *ButlerService) RequestAuthorization(actionID string, targetID int, command, reasoning string) {
    log.Printf("[Butler] Requesting authorization for action: %s", actionID)
    log.Printf("[Butler] Command: %s", command)
    log.Printf("[Butler] Reasoning: %s", reasoning)
    
    s.hub.BroadcastGeneric(map[string]interface{}{
        "type":        "AUTH_REQUEST",
        "action_id":   actionID,
        "sender_id":   s.butlerID,
        "sender_name": s.butlerName,
        "sender_role": "BUTLER",
        "target_id":   targetID,
        "command":     command,
        "reasoning":   reasoning,
    })
}
```

## 示例

### 处理用户消息

```go
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

// Butler 处理消息
{
  "type": "CHAT",
  "sender_id": 2,
  "sender_name": "Butler",
  "sender_role": "BUTLER",
  "target_id": 1,
  "payload": "I'll check the status of agent 7. Let me send an authorization request.",
  "timestamp": "2024-01-01T00:00:01Z"
}

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

// 管理员批准
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

## 扩展性

### 添加新命令

1. 在 EinoBrain 中添加命令解析
2. 在 tools.go 中添加命令执行
3. 测试命令

### 添加新消息类型

1. 定义消息类型
2. 在处理逻辑中添加消息处理
3. 测试消息处理

## 性能优化

- 异步处理
- 连接池
- 缓存
- 并发处理

## 安全性

- 授权请求
- 命令验证
- 输入过滤
- 错误处理
