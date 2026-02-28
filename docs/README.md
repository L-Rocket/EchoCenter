# EchoCenter 文档

欢迎来到 EchoCenter 的详细文档！本项目是一个智能代理中心系统，用于协调和管理多个 AI 代理。

## 📚 文档结构

- **[架构](./architecture/)** - 系统架构和组件说明
  - [概述](./architecture/overview.md) - 系统架构概览
  - [后端](./architecture/backend.md) - 后端架构和组件
  - [前端](./architecture/frontend.md) - 前端架构和组件

- **[API](./api/)** - API 文档
  - [认证](./api/authentication.md) - 认证机制
  - [WebSocket](./api/websocket.md) - WebSocket 通信协议
  - [端点](./api/endpoints.md) - REST API 端点

- **[代理](./agents/)** - 代理文档
  - [Butler](./agents/butler.md) - 核心代理
  - [Storage-Custodian](./agents/storage-custodian.md) - 存储管理代理
  - [其他代理](./agents/other-agents.md) - 其他代理说明

- **[开发](./development/)** - 开发指南
  - [环境设置](./development/setup.md) - 环境配置
  - [测试](./development/testing.md) - 测试指南
  - [贡献](./development/contributing.md) - 贡献指南

## 🚀 快速开始

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

### 运行

```bash
cd backend/scripts
./start_with_custodian.sh
```

## 📖 详细文档

### 架构

#### 系统架构
EchoCenter 采用分层架构设计，包含以下主要组件：

- **后端服务** - 基于 Gin 框架的 HTTP API 服务
- **WebSocket 通信** - 实时双向通信
- **Butler 服务** - 核心代理，协调其他代理
- **SQLite 数据库** - 本地持久化存储

#### 组件关系
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Frontend  │────>│   Backend   │────>│   Database  │
│  (React)    │     │   (Go)      │     │  (SQLite)   │
└─────────────┘     └─────────────┘     └─────────────┘
                         │
                         ▼
                    ┌─────────────┐
                    │   Butler    │
                    │   Service   │
                    └─────────────┘
                         │
                         ▼
                    ┌─────────────┐
                    │   Agents    │
                    │  (Python)   │
                    └─────────────┘
```

### API

#### 认证
系统使用 JWT 令牌进行认证。用户登录后会获得一个令牌，后续请求需要在 `Authorization` 头中携带该令牌。

#### WebSocket
系统使用 WebSocket 进行实时通信。支持的消息类型：
- `SYSTEM_LOG` - 系统日志
- `CHAT` - 聊天消息
- `CHAT_STREAM` - 流式聊天
- `CHAT_STREAM_END` - 流结束

### 代理

#### Butler
Butler 是核心代理，负责：
- 接收用户消息
- 分析意图
- 发送授权请求
- 执行命令
- 流式返回结果

#### Storage-Custodian
Storage-Custodian 负责：
- 管理存储系统
- 监控文件和磁盘空间
- 响应 Butler 的指令

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License
