# Butler

## Overview

Butler is the core agent of EchoCenter, responsible for coordinating other agents and handling user requests. It is an AI-driven agent capable of understanding user intent and executing complex tasks.

## Design Goals

- Provide a single conversational entrypoint for human users.
- Hide multi-agent orchestration details behind a stable Butler interface.
- Keep high-risk operations gated behind explicit authorization.
- Preserve conversation continuity without allowing context to grow without bound.
- Keep observability optional and low-coupled so production can enable or disable it by configuration.

## Design Overview

Butler is not just a chat bot. In EchoCenter it acts as an orchestration layer sitting between:

- human users on WebSocket / HTTP channels
- the Butler runtime service
- the Eino-based reasoning brain
- persistence and authorization state
- downstream agents and integrations

In practice, Butler is split into two layers:

1. `ButlerService`
   Handles transport-facing behavior such as inbound user messages, streaming replies, persistence, authorization handoff, and broadcasting monitor events.
2. `EinoBrain`
   Handles model-facing behavior such as prompt assembly, session history, runtime context compaction, and model invocation.

This split is intentional:

- transport logic can evolve without rewriting model orchestration
- model configuration can change without affecting WebSocket semantics
- observability can hook into runtime events without tightly coupling itself to all business code

## Runtime Architecture

### ButlerService

`ButlerService` owns the runtime flow for user-facing interactions:

- receives user input from the WebSocket handler
- builds current system state, including active agents
- starts a traced reasoning session
- calls the brain in streaming mode
- persists final chat output
- broadcasts both stream chunks and final `CHAT` messages
- forwards selected outbound replies to integrations such as Feishu

This service is also where authorization and agent-monitor visibility are coordinated, because those concerns are closer to application workflow than to LLM prompting.

### EinoBrain

`EinoBrain` is the model runtime used by Butler. It is responsible for:

- building the Butler system prompt
- assembling session conversation history
- injecting rolling summaries when context has been compacted
- invoking the configured OpenAI-compatible model endpoint
- appending assistant replies back into in-memory history

The brain is intentionally session-oriented. Each user conversation gets an isolated runtime context keyed by `sessionID`.

### Conversation State

The runtime state for a conversation is no longer a raw append-only message array. It is structured as:

- `Summary`
- `RecentMessages`
- `LastCompactedAt`

This design makes context management explicit:

- `Summary` stores compressed memory of older turns
- `RecentMessages` preserves the freshest uncompressed interaction window
- `LastCompactedAt` provides traceability for runtime behavior and observability

## Context Compaction Design

One of Butler's newer design goals is to avoid unbounded prompt growth while keeping long-running conversations coherent.

When runtime context crosses a configured threshold:

- Butler invokes an internal runtime-only compaction component
- older messages are summarized into `Summary`
- only a recent window of raw messages is retained
- the next model call receives:
  - the system prompt
  - a synthetic system memory message built from `Summary`
  - the recent message window

Key properties of this design:

- the compactor is not exposed as a user-facing chat agent
- compaction failure does not block the main reply path
- the compactor can reuse the Butler model or use a cheaper dedicated model
- the compacted summary becomes part of the next prompt as hidden runtime memory

This gives Butler a rolling-memory behavior without requiring persistent long-context replay on every request.

## Request Lifecycle

### User Message Path

1. A user sends a message to Butler.
2. `ButlerService` creates a stream id and session id.
3. Current system state is built from repository data.
4. A Butler runtime span is started for observability.
5. `EinoBrain` prepares the conversation:
   - appends the new user turn
   - compacts history if thresholds are exceeded
   - builds the final prompt message list
6. The model is invoked in streaming mode.
7. Stream chunks are forwarded as `CHAT_STREAM`.
8. The final assistant reply is persisted and emitted as `CHAT`.
9. A `CHAT_STREAM_END` event closes the stream.

### Authorization Path

Sensitive or side-effecting operations are intentionally separated from ordinary chat:

1. Butler decides an operation needs approval.
2. An `AUTH_REQUEST` is emitted to the authorized recipient.
3. The action remains pending until explicit approval or rejection.
4. Approved actions continue execution; rejected actions terminate with a user-visible cancellation outcome.

This pattern keeps the LLM from being the final authority on operations that may change state or affect external systems.

### Agent Coordination Path

When Butler needs another agent:

1. Butler reasons about which downstream capability is needed.
2. A task is routed to the target agent through the existing hub / message path.
3. The downstream agent executes the task and returns a result.
4. Butler incorporates the returned information into the user-facing response.

The architectural point here is that Butler remains the control plane, while specialized agents remain execution planes.

## Observability Design

Butler observability is designed to be optional and low-coupled.

There are two layers:

1. Official Eino callback integration
   `github.com/cloudwego/eino-ext/callbacks/cozeloop`
2. Thin local Butler spans
   Used for application-specific events that generic model callbacks do not express clearly, such as:
   - `butler.user_message`
   - `butler.context_compaction`

This means:

- model/tool/agent execution can flow into CozeLoop automatically
- Butler-specific lifecycle events remain visible
- the rest of the application only depends on a thin observability interface
- disabling CozeLoop by config reduces the observer to no-op behavior

## Design Boundaries

What Butler is responsible for:

- user-facing orchestration
- high-level reasoning and response synthesis
- approval gating for sensitive actions
- coordinating downstream agents
- runtime memory management and compaction

What Butler is not responsible for:

- being a generic external Coze bot adapter
- directly replacing specialized worker agents
- storing infinite raw conversation history in prompts
- making irreversible operational decisions without authorization

## Why This Design

This design trades a bit of implementation complexity for cleaner runtime behavior:

- session state is easier to reason about than a single raw history buffer
- context compaction reduces token pressure on long conversations
- optional CozeLoop tracing keeps monitoring powerful but non-invasive
- separating service logic from brain logic makes future model/runtime changes safer

## Workflow

### User Request Flow

```
1. User sends a message to Butler
   ↓
2. Butler receives the message
   ↓
3. AI brain analyzes the message
   ↓
4. Decides the response method
   ↓
5. Sends response to the user
```

### Command Execution Flow

```
1. Butler detects a command needs to be executed
   ↓
2. Sends authorization request to the admin
   ↓
3. Waits for admin approval/rejection
   ↓
4. If approved, executes the command
   ↓
5. Streams the result back to the admin
```

### Agent Coordination Flow

```
1. Butler needs an agent to perform a task
   ↓
2. Sends instruction to the agent
   ↓
3. Agent performs the task
   ↓
4. Agent returns the result
   ↓
5. Butler processes the result
   ↓
6. Sends final response to the user
```

## Configuration

### Environment Variables

```env
# Butler AI Configuration
BUTLER_BASE_URL=https://api.siliconflow.cn/v1
BUTLER_API_TOKEN=your_api_token_here
BUTLER_MODEL=Qwen/Qwen3-8B

# Optional: dedicated runtime compaction model
BUTLER_CONTEXT_COMPACTION_ENABLED=true
BUTLER_CONTEXT_COMPACTION_BASE_URL=
BUTLER_CONTEXT_COMPACTION_API_TOKEN=
BUTLER_CONTEXT_COMPACTION_MODEL=

# Optional: CozeLoop observability
OBSERVABILITY_COZELOOP_ENABLED=false
OBSERVABILITY_SERVICE_NAME=echocenter-backend
COZELOOP_WORKSPACE_ID=
COZELOOP_API_TOKEN=
```

### Configuration Description

- `BUTLER_BASE_URL` - Butler model API base URL
- `BUTLER_API_TOKEN` - Butler model API token
- `BUTLER_MODEL` - Butler model name
- `BUTLER_CONTEXT_COMPACTION_*` - optional dedicated model for runtime context compaction
- `COZELOOP_WORKSPACE_ID` / `COZELOOP_API_TOKEN` - CozeLoop tracing only, not Butler model calls

### Coze Integration Notes

- If you want CozeLoop observability, fill `COZELOOP_WORKSPACE_ID` and `COZELOOP_API_TOKEN` in `backend/.env`.
- If you want Butler to call a model, fill `BUTLER_BASE_URL`, `BUTLER_API_TOKEN`, and `BUTLER_MODEL`.
- If by "Coze" you mean a Coze bot/runtime endpoint, the project does not yet provide a dedicated Coze bot adapter; Butler currently expects an OpenAI-compatible model endpoint.

## Message Types

### CHAT

Regular chat message:

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

Streaming chat message:

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

Stream end message:

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

Authorization request:

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

## AI Brain

### EinoBrain

Butler uses Eino as the AI brain:

```go
type EinoBrain struct {
    baseURL    string
    apiToken   string
    model      string
}
```

**Functions**:
- Call AI API
- Analyze messages
- Generate responses
- Execute commands

### ChatStream

Streaming chat:

```go
func (b *EinoBrain) ChatStream(ctx context.Context, prompt string) (string, error) {
    // Call AI API
    // Stream return response
}
```

### ExecuteCommand

Execute command:

```go
func (b *EinoBrain) ExecuteCommand(ctx context.Context, command string, callback func(string) error) error {
    // Parse command
    // Execute command
    // Stream return result
}
```

## Tool Functions

### ExecuteCommandDirect

Directly execute command:

```go
func ExecuteCommandDirect(ctx context.Context, command string) (string, error) {
    // Execute command
    // Return result
}
```

### RegisterAgentResponse

Register agent response:

```go
func RegisterAgentResponse(agentID int, response string) error {
    // Register response
    // Notify waiting commands
}
```

## Best Practices

### 1. Error Handling

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

### 2. Timeout Handling

```go
func (s *ButlerService) ExecutePendingCommand(ctx context.Context, streamID string, senderID int, approved bool) {
    ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
    defer cancel()
    
    // Execute command
    _, err := s.brain.ExecuteCommand(ctx, result, func(chunk string) error {
        // ...
    })
    
    if err != nil {
        log.Printf("Command execution timeout: %v", err)
    }
}
```

### 3. Logging

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

## Example

### Handling User Message

```go
// User sends message
{
  "type": "CHAT",
  "sender_id": 1,
  "sender_name": "Admin",
  "sender_role": "ADMIN",
  "target_id": 2,
  "payload": "Check the status of agent 7",
  "timestamp": "2024-01-01T00:00:00Z"
}

// Butler processes message
{
  "type": "CHAT",
  "sender_id": 2,
  "sender_name": "Butler",
  "sender_role": "BUTLER",
  "target_id": 1,
  "payload": "I'll check the status of agent 7. Let me send an authorization request.",
  "timestamp": "2024-01-01T00:00:01Z"
}

// Butler sends authorization request
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

// Admin approves
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

// Butler executes command
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

## Scalability

### Adding New Commands
1. Add command parsing in EinoBrain.
2. Add command execution in tools.go.
3. Test the command.

### Adding New Message Types
1. Define the message type.
2. Add message handling logic.
3. Test message processing.

## Performance Optimization
- Asynchronous processing
- Connection pool
- Caching
- Concurrent processing

## Security
- Authorization request
- Command validation
- Input filtering
- Error handling
