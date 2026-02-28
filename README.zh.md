# EchoCenter

[文档站点](https://l-rocket.github.io/EchoCenter/) | [English README](./README.md)

EchoCenter 是一个智能代理中心系统，用于协调和管理多个 AI 代理。它提供了一个集中的平台，用于代理注册、消息传递、命令执行和状态监控。

## 功能特性

- **多代理管理**：支持注册和管理多个 AI 代理
- **实时消息传递**：通过 WebSocket 实现低延迟的实时通信
- **命令执行**：支持代理之间的命令传递和执行
- **状态监控**：实时监控代理状态和系统指标
- **持久化存储**：使用 SQLite 数据库持久化聊天记录和系统数据
- **授权机制**：安全的用户认证和授权系统

## 架构

### 后端

- **Gin 框架**：用于 HTTP API 服务
- **WebSocket**：实现实时消息传递
- **SQLite**：本地文件数据库
- **Eino**：AI 推理引擎
- **Butler**：核心代理服务

### 前端

- **React**：用户界面框架
- **TypeScript**：类型安全的 JavaScript
- **Tailwind CSS**：样式框架
- **Vite**：构建工具

## 快速开始

### 前置要求

- Go 1.21+
- Python 3.9+
- Node.js 18+
- npm 或 yarn

### 安装

```bash
# 克隆仓库
git clone https://github.com/L-Rocket/EchoCenter.git
cd EchoCenter

# 安装后端依赖
cd backend
go mod download

# 安装前端依赖
cd ../frontend
npm install

# 安装 Python 依赖
cd ../backend
pip install -r requirements.txt
```

### 配置

在 `backend/.env` 文件中配置环境变量：

```env
# 数据库配置
DATABASE_URL=echocenter.db

# Butler 配置
BUTLER_BASE_URL=https://api.siliconflow.cn/v1
BUTLER_API_TOKEN=your_api_token_here
BUTLER_MODEL=gpt-3.5-turbo

# JWT 配置
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=24h
```

### 运行

使用启动脚本一键启动所有服务：

```bash
cd backend/scripts
./start_with_custodian.sh
```

这个脚本会：
1. 启动后端服务
2. 初始化数据库
3. 注册代理
4. 启动 Storage-Custodian 代理

### 停止

按 `Ctrl+C` 停止所有服务。

## 项目结构

```
EchoCenter/
├── backend/
│   ├── cmd/
│   │   └── server/          # 服务入口
│   ├── internal/
│   │   ├── api/             # API 层
│   │   │   ├── handler/     # 处理器
│   │   │   ├── middleware/  # 中间件
│   │   │   └── router/      # 路由
│   │   ├── butler/          # Butler 服务
│   │   ├── auth/            # 认证服务
│   │   ├── models/          # 数据模型
│   │   ├── repository/      # 数据存储层
│   │   └── websocket/       # WebSocket 服务
│   ├── scripts/             # 启动脚本
│   ├── mock_agents/         # 代理模拟器
│   └── pkg/                 # 公共包
├── frontend/
│   ├── src/
│   │   ├── components/      # React 组件
│   │   ├── pages/           # 页面
│   │   ├── context/         # React Context
│   │   ├── store/           # 状态管理
│   │   └── App.tsx          # 主应用
│   └── package.json
├── specs/                   # 项目规范
└── README.md
```

## API 文档

### 认证

#### 登录

```
POST /api/auth/login
```

请求体：
```json
{
  "username": "admin",
  "password": "admin123"
}
```

响应：
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### WebSocket

连接地址：`ws://localhost:8080/api/ws?token=your_token`

消息格式：
```json
{
  "type": "CHAT",
  "sender_id": 1,
  "target_id": 2,
  "payload": "Hello",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

## 代理

### Butler

核心代理，负责协调其他代理和处理用户请求。

### Storage-Custodian

管理存储系统的代理，负责文件和磁盘空间监控。

### 其他代理

- **Weather-Sentinel**：天气监控代理
- **Code-Reviewer-AI**：代码审查代理
- **Security-Audit-Bot**：安全审计代理
- **Echo-Bot**：回显代理

## 开发

### 后端开发

```bash
cd backend
go run cmd/server/main.go
```

### 前端开发

```bash
cd frontend
npm run dev
```

### 运行测试

```bash
# 后端测试
cd backend
go test ./...

# 前端测试
cd frontend
npm test
```

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！