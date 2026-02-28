# 后端架构

## 概述

后端服务是 EchoCenter 的核心，负责处理 HTTP 请求、WebSocket 通信、业务逻辑和数据持久化。

## 项目结构

```
backend/
├── cmd/
│   └── server/
│       └── main.go          # 入口点
├── internal/
│   ├── api/                 # API 层
│   │   ├── handler/        # 处理器
│   │   ├── middleware/     # 中间件
│   │   ├── router/         # 路由
│   │   └── websocket/      # WebSocket
│   ├── auth/               # 认证
│   ├── butler/             # Butler 服务
│   ├── config/             # 配置
│   ├── models/             # 数据模型
│   └── repository/         # 数据存储
├── pkg/                    # 公共包
│   └── errors/            # 错误处理
└── scripts/               # 启动脚本
```

## 核心组件

### 1. 入口点 (`cmd/server/main.go`)

```go
func main() {
    // 1. 加载配置
    cfg, err := config.Load()
    
    // 2. 初始化数据库
    repo, err := repository.New(&cfg.Database)
    
    // 3. 初始化管理员
    repo.InitializeAdmin(ctx, ...)
    
    // 4. 初始化认证服务
    authSvc := auth.NewService(&cfg.Auth, repo)
    
    // 5. 初始化 Butler 服务
    butler.InitButler(...)
    
    // 6. 初始化 WebSocket hub
    hub := websocket.NewHub(...)
    
    // 7. 设置路由
    router.Setup(r, h, authSvc)
    
    // 8. 启动服务
    r.Run(fmt.Sprintf("%s:%d", cfg.Server.Host, cfg.Server.Port))
}
```

### 2. 配置 (`internal/config/config.go`)

加载环境变量并配置系统：

```go
type Config struct {
    Server ServerConfig
    Database DatabaseConfig
    Auth AuthConfig
    CORS CORSConfig
}
```

**环境变量**：
- `SERVER_HOST` - 服务器主机 (默认: 0.0.0.0)
- `SERVER_PORT` - 服务器端口 (默认: 8080)
- `DB_PATH` - 数据库路径 (默认: ./echocenter.db)
- `BUTLER_BASE_URL` - Butler AI 基础 URL
- `BUTLER_API_TOKEN` - Butler API 令牌
- `BUTLER_MODEL` - Butler 模型 (默认: gpt-3.5-turbo)
- `JWT_SECRET` - JWT 密钥
- `CORS_ALLOWED_ORIGINS` - 允许的跨域源

### 3. 认证 (`internal/auth/auth.go`)

JWT 认证服务：

```go
type Service interface {
    GenerateToken(userID int) (string, error)
    ValidateToken(token string) (int, error)
}
```

**功能**：
- 生成 JWT 令牌
- 验证令牌
- 解析用户 ID

### 4. 路由 (`internal/api/router/router.go`)

定义所有 API 路由：

```go
// 公共路由
api.GET("/ping", h.Ping)
api.POST("/auth/login", h.Login)
api.GET("/ws", h.HandleWS)

// 受保护路由
protected.GET("/messages", h.GetMessages)
protected.POST("/messages", h.IngestMessage)
protected.GET("/users/agents", h.GetAgents)
protected.POST("/chat/auth/response", h.AuthResponse)

// 管理员路由
admin.POST("", h.CreateUser)
admin.POST("/agents", h.RegisterAgent)
```

### 5. 处理器 (`internal/api/handler/`)

处理 HTTP 请求：

#### `handler.go`
- `Login` - 用户登录
- `GetMessages` - 获取消息
- `IngestMessage` - 推送消息
- `GetAgents` - 获取代理列表
- `RegisterAgent` - 注册代理
- `AuthResponse` - 授权响应

#### `ws_gateway.go`
- `HandleWS` - 处理 WebSocket 连接

### 6. WebSocket (`internal/api/websocket/`)

#### `websocket.go`
WebSocket hub 管理：

```go
type Hub interface {
    Run(ctx context.Context)
    Broadcast(msg *Message)
    Register(client *Client)
    Unregister(client *Client)
    GetClient(userID int) (*Client, bool)
    BroadcastGeneric(msg interface{})
}
```

**消息类型**：
- `SYSTEM_LOG` - 系统日志
- `CHAT` - 聊天消息
- `CHAT_STREAM` - 流式聊天
- `CHAT_STREAM_END` - 流结束

#### `message_handler.go`
消息处理器：

```go
type MessageHandler interface {
    HandleMessage(ctx context.Context, msg *Message)
}
```

**处理器**：
- `PersistingMessageHandler` - 持久化消息
- `ButlerMessageHandler` - 处理发给 Butler 的消息
- `AgentResponseHandler` - 处理代理响应

### 7. Butler 服务 (`internal/butler/`)

#### `service.go`
Butler 核心服务：

```go
type Service interface {
    GetButlerID() int
    ProcessLog(ctx context.Context, msg models.Message)
    RequestAuthorization(actionID string, targetID int, command, reasoning string)
    HandleUserMessage(ctx context.Context, senderID int, payload string)
}
```

**功能**：
- 接收用户消息
- 分析意图
- 发送授权请求
- 执行命令
- 流式返回结果

#### `eino_brain.go`
AI 大脑：

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

#### `tools.go`
工具函数：

```go
func ExecuteCommandDirect(ctx context.Context, command string) (string, error)
func RegisterAgentResponse(agentID int, response string) error
```

### 8. 数据存储 (`internal/repository/repository.go`)

统一的数据访问接口：

```go
type Repository interface {
    // 用户
    InitializeAdmin(ctx context.Context, username, password string, bcryptCost int) error
    GetUserByID(ctx context.Context, id int) (*User, error)
    GetUserByUsername(ctx context.Context, username string) (*User, error)
    
    // 代理
    GetAgents(ctx context.Context) ([]*User, error)
    
    // 消息
    CreateMessage(ctx context.Context, msg *Message) error
    GetMessages(ctx context.Context, limit, offset int) ([]*Message, error)
    
    // 聊天
    CreateChatMessage(ctx context.Context, msg *ChatMessage) error
    GetChatHistory(ctx context.Context, userID int, limit, offset int) ([]*ChatMessage, error)
}
```

### 9. 数据模型 (`internal/models/models.go`)

```go
type User struct {
    ID       int
    Username string
    PasswordHash string
    Role     string
    APIToken string
}

type Message struct {
    ID         int
    AgentID    string
    Level      string
    Content    string
    Timestamp  time.Time
}

type ChatMessage struct {
    ID        int
    SenderID  int
    TargetID  int
    Payload   string
    Timestamp time.Time
}
```

## 工作流程

### 用户登录流程

```
1. 用户发送 POST /api/auth/login
2. 处理器验证用户名和密码
3. 认证服务生成 JWT 令牌
4. 返回令牌给用户
```

### WebSocket 连接流程

```
1. 用户发送 GET /api/ws?token=xxx
2. 验证 JWT 令牌
3. 创建 WebSocket 连接
4. 注册到 Hub
5. 开始通信
```

### 消息处理流程

```
1. 用户发送消息
2. WebSocket hub 接收消息
3. 消息处理器路由到目标
4. Butler 处理消息
5. AI 大脑分析
6. 返回响应
```

### 命令执行流程

```
1. Butler 检测到需要执行命令
2. 发送授权请求给管理员
3. 管理员批准/拒绝
4. 执行命令
5. 流式返回结果
```

## 关键特性

### 1. 并发处理
- 使用 goroutine 处理并发请求
- WebSocket hub 使用 channel 进行通信

### 2. 连接管理
- WebSocket 连接池
- 自动心跳检测
- 断线重连

### 3. 数据持久化
- SQLite 数据库
- 连接池管理
- 事务支持

### 4. 错误处理
- 统一的错误处理
- 错误包装
- 日志记录

## 扩展性

### 添加新 API 端点

1. 在 `handler` 中添加处理器
2. 在 `router` 中添加路由
3. 添加中间件（如需要）
4. 测试端点

### 添加新消息类型

1. 在 `websocket.go` 中添加消息类型
2. 在 `message_handler.go` 中添加处理器
3. 更新消息处理逻辑

### 添加新代理

1. 创建 Python 代理脚本
2. 实现 WebSocket 通信
3. 注册到数据库
4. 启动代理

## 性能优化

- 数据库连接池
- WebSocket 连接池
- 异步处理
- 缓存（未来）

## 安全性

- JWT 认证
- 密码哈希
- CORS 配置
- 输入验证
- 错误处理
