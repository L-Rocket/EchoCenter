# Butler

## 概述

Butler 是 EchoCenter 的核心代理，负责协调其他代理和处理用户请求。它是一个 AI 驱动的代理，能够理解用户意图并执行复杂的任务。

## 设计目标

- 为人类用户提供统一的对话入口。
- 将多 Agent 协调细节收敛在 Butler 背后。
- 对高风险操作统一走显式授权。
- 保持长对话连续性，同时避免上下文无限膨胀。
- 让观测能力可插拔、低耦合，线上可按配置开启或关闭。

## 设计总览

Butler 并不只是一个聊天机器人。在 EchoCenter 里，它是一个位于以下对象之间的编排层：

- 人类用户的 WebSocket / HTTP 入口
- Butler runtime service
- 基于 Eino 的推理大脑
- 持久化与授权状态
- 下游 Agent 和外部集成

当前实现上，Butler 主要拆成两层：

1. `ButlerService`
   负责偏传输层和应用层的事情，例如接收用户消息、流式返回、持久化、授权衔接和监控广播。
2. `EinoBrain`
   负责偏模型运行时的事情，例如构造 prompt、维护 session 历史、运行时上下文压缩和模型调用。

这样拆分的原因是：

- 传输逻辑可以独立演进，不必频繁改模型编排
- 模型配置和上下文策略变更时，不会牵动 WebSocket 语义
- 观测系统可以挂在少量关键点上，而不必侵入所有业务代码

> Design note: Butler is intentionally split into a service layer and a brain layer so transport concerns and model-runtime concerns can evolve independently.

## 运行时架构

### ButlerService

`ButlerService` 负责用户侧的主流程：

- 接收用户输入
- 构建当前系统状态，包括在线 Agent 信息
- 启动一次带 trace 的推理会话
- 调用 brain 的流式推理
- 持久化最终回复
- 广播 `CHAT_STREAM` 和最终 `CHAT`
- 按需要把回复转发到外部集成，例如飞书

授权和 Agent 监控也放在这一层，因为这些更接近应用工作流，而不是纯模型 prompt 逻辑。

### EinoBrain

`EinoBrain` 是 Butler 的模型运行时。它主要负责：

- 构建 Butler system prompt
- 组装会话上下文
- 在上下文被压缩后注入滚动摘要
- 调用配置好的 OpenAI 兼容模型接口
- 把 assistant 回复追加回会话历史

这个 brain 是按 session 管理的。每个用户会话都会有一份独立的 runtime context。

### 会话状态

现在的会话状态不再是简单的“原始消息数组”，而是显式拆成：

- `Summary`
- `RecentMessages`
- `LastCompactedAt`

这样设计的意义是：

- `Summary` 保存对旧消息的压缩记忆
- `RecentMessages` 保留最近一段未压缩原始对话
- `LastCompactedAt` 便于观测和排查运行时行为

> Design note: the summary is hidden runtime memory, while recent messages preserve short-term conversational fidelity.

## 上下文压缩设计

Butler 的一个核心设计目标，是让长对话继续可用，但不要把所有历史原文都重复塞进 prompt。

当运行时上下文超过配置阈值时：

- Butler 会调用一个仅供 runtime 使用的内部 compactor
- 较旧消息会被总结进 `Summary`
- 只保留最近窗口的原始消息
- 下一次模型调用会看到：
  - system prompt
  - 由 `Summary` 构造的隐藏 system memory
  - 最近消息窗口

这个设计有几个关键点：

- compactor 不是用户可聊天的 Agent
- 压缩失败不会中断主对话
- compactor 可以复用 Butler 模型，也可以单独走一个便宜模型
- 压缩结果会作为隐藏的运行时记忆参与后续推理

所以 Butler 获得的是一种“滚动记忆”能力，而不是每次都完整重放所有历史。

> Design note: compaction is best-effort and must never block the main user reply path.

## 请求生命周期

### 用户消息路径

1. 用户向 Butler 发送消息。
2. `ButlerService` 生成 stream id 和 session id。
3. 从 repository 构建当前系统状态。
4. 启动一段 Butler runtime trace。
5. `EinoBrain` 准备会话：
   - 追加当前用户输入
   - 若超阈值则执行上下文压缩
   - 生成最终 prompt 消息列表
6. 以流式方式调用模型。
7. 中间结果通过 `CHAT_STREAM` 返回。
8. 最终回复落库，并以 `CHAT` 广播。
9. `CHAT_STREAM_END` 用来结束本次流。

### 授权路径

敏感或具有副作用的操作，与普通聊天是明确分开的：

1. Butler 判断当前操作需要授权。
2. 向目标管理员发送 `AUTH_REQUEST`。
3. 动作进入 pending 状态，等待批准或拒绝。
4. 批准后继续执行；拒绝后以显式取消结果结束。

这个设计的目的是避免让 LLM 成为高风险操作的最终裁决者。

### Agent 协调路径

当 Butler 需要别的 Agent 时：

1. Butler 判断需要哪类下游能力。
2. 通过现有 hub / message 通道把任务路由到目标 Agent。
3. 下游 Agent 执行任务并返回结果。
4. Butler 将返回结果整合成面向用户的最终回答。

换句话说，Butler 是控制平面，而专用 Agent 是执行平面。

## 观测设计

Butler 的观测能力被设计成可选、低耦合。

当前有两层：

1. 官方 Eino callback 接入
   `github.com/cloudwego/eino-ext/callbacks/cozeloop`
2. 本地很薄的一层 Butler span
   用来补充通用模型 callback 不容易表达的业务事件，例如：
   - `butler.user_message`
   - `butler.context_compaction`

这意味着：

- 模型 / tool / agent 执行可以自动进入 CozeLoop
- Butler 自身的重要生命周期也能被观测到
- 应用其余部分只依赖一层很薄的 observability 接口
- 关闭 CozeLoop 后会自然降级成 no-op

> Design note: observability is optional by design; when disabled, Butler should keep the same business behavior.

## 设计边界

Butler 负责：

- 面向用户的总编排
- 高层推理与回答整合
- 敏感操作的授权门控
- 下游 Agent 协调
- 运行时记忆管理与上下文压缩

Butler 不负责：

- 充当通用 Coze Bot 适配器
- 替代专门的执行型 Agent
- 在 prompt 中无限保留原始长历史
- 绕过授权直接做不可逆操作

## 为什么这样设计

这个设计牺牲了一点实现简单性，换来了更稳定的运行时行为：

- 显式 session state 比简单历史数组更容易维护
- 上下文压缩能降低长对话的 token 压力
- 可选的 CozeLoop trace 让监控能力强但不侵入
- service 和 brain 分层，让后续替换模型或调整 runtime 策略更安全

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
BUTLER_MODEL=Qwen/Qwen3-8B

# 可选：给运行时上下文压缩单独指定模型
BUTLER_CONTEXT_COMPACTION_ENABLED=true
BUTLER_CONTEXT_COMPACTION_BASE_URL=
BUTLER_CONTEXT_COMPACTION_API_TOKEN=
BUTLER_CONTEXT_COMPACTION_MODEL=

# 可选：CozeLoop 观测
OBSERVABILITY_COZELOOP_ENABLED=false
OBSERVABILITY_SERVICE_NAME=echocenter-backend
COZELOOP_WORKSPACE_ID=
COZELOOP_API_TOKEN=
```

### 配置说明

- `BUTLER_BASE_URL` - Butler 模型 API 地址
- `BUTLER_API_TOKEN` - Butler 模型 API 令牌
- `BUTLER_MODEL` - Butler 模型名称
- `BUTLER_CONTEXT_COMPACTION_*` - 可选的运行时上下文压缩模型配置
- `COZELOOP_WORKSPACE_ID` / `COZELOOP_API_TOKEN` - 仅用于 CozeLoop 观测，不参与 Butler 调模型

### Coze 接入说明

- 如果你要接入 CozeLoop 观测，请在 `backend/.env` 中填写 `COZELOOP_WORKSPACE_ID` 和 `COZELOOP_API_TOKEN`。
- 如果你要让 Butler 调模型，请填写 `BUTLER_BASE_URL`、`BUTLER_API_TOKEN` 和 `BUTLER_MODEL`。
- 如果你说的“扣子”是普通 Coze Bot / Runtime 接口，那么当前项目还没有单独的 Coze Bot 适配器；Butler 目前仍要求一套 OpenAI 兼容模型接口。

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
