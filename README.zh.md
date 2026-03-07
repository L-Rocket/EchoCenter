# EchoCenter 🌐

<p align="center">
  <a href="https://l-rocket.github.io/EchoCenter/zh/"><strong>探索文档 »</strong></a>
  <br />
  <br />
  <a href="https://github.com/L-Rocket/EchoCenter/issues">报告 Bug</a>
  ·
  <a href="https://github.com/L-Rocket/EchoCenter/issues">提交需求</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Go-1.22+-00ADD8?style=flat-square&logo=go" alt="Go Version" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react" alt="React Version" />
  <img src="https://img.shields.io/badge/Vite-7-646CFF?style=flat-square&logo=vite" alt="Vite Version" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="License" />
</p>

---

[文档站点](https://l-rocket.github.io/EchoCenter/zh/) | [English README](./README.md)

**EchoCenter** 是一个专业、模块化的智能代理 (Agent) 管理中心。它提供了一个集中的平台，用于代理注册、基于 WebSocket 的实时双向消息传递，以及由核心代理 **Butler** 协调的智能命令执行。

## ✨ 核心特性

- **🤖 多代理协同**：无缝管理和协调各种 AI 代理（支持 Python、Go 等多种语言）。
- **⚡ 实时消息传递**：基于高性能 WebSocket 实现的低延迟、双向通信。
- **🧠 Butler 核心**：AI 驱动的协调者，能够理解用户意图并执行复杂的跨代理工作流。
- **🖥️ 双模式 Butler 工作台**：支持 `我 ↔ Butler` 直连会话与 `Butler ↔ Agents` 监控时间线切换。
- **🌍 内置中英双语**：核心管理与聊天流程支持 English / 简体中文切换。
- **⚙️ Settings 管理台**：统一入口管理 Agent（创建/移除/Token）与外部集成（如飞书）。
- **🛰️ 飞书 WS 桥接**：支持飞书长连接入站、策略过滤、入站/出站转发与连接器凭据校验。
- **✅ 飞书授权卡片**：Butler 授权请求可在飞书交互卡片中直接批准/拒绝。
- **📊 交互式大盘**：基于 React 的现代化 UI，实时监控代理状态和全系统日志。
- **🔒 安全架构**：强制 JWT 认证与独立 Agent API Token，且 Agent 列表仅返回 `token_hint`（不返回明文 Token）。
- **📂 灵活持久化**：完整的聊天和命令历史由可配置的数据库层持久化，可通过 `DB_DRIVER` + DSN/PG_* 配置启用 PostgreSQL。

## 🛠 技术栈

| 后端 | 前端 | 代理 (Simulators) |
| :--- | :--- | :--- |
| **Go 1.22+** | **React 19** | **Python 3.9+** |
| Gin Gonic | TypeScript | OpenAI SDK |
| Gorilla WebSocket | Tailwind CSS (v4) | websockets |
| 可配置 SQL 存储 / PostgreSQL | Zustand | psutil |
| Eino (AI 引擎) | Shadcn/ui | python-dotenv |

## 🚀 快速开始

### 前置要求

- **Go**: 1.22 或更高版本
- **Node.js**: 20 或更高版本 (推荐使用 pnpm)
- **Python**: 3.9 或更高版本

### 安装与运行

```bash
# 1. 克隆仓库
git clone https://github.com/L-Rocket/EchoCenter.git
cd EchoCenter

# 2. 一键安装所有依赖 (后端, 前端, Python)
# 这一步会自动从 .env.example 创建 backend/.env
make install

# 3. 配置 API Key
# 编辑 backend/.env 文件，添加你的 BUTLER_API_TOKEN (来自 SiliconFlow 或 OpenAI)
# 并确保 JWT_SECRET 设置为一个强随机字符串。

# 4. (可选) 需要 PostgreSQL 时在 backend/.env 中补充配置
# 设置 DB_DRIVER=postgres

# 5. 使用 mock 数据和代理启动 (首次运行推荐)
make run-mock
```

输入 `make help` 可以查看所有可用命令。

系统启动后可访问 `http://localhost:5173`。默认管理员凭据：`admin` / `admin123`。

### 快速切换驱动

```bash
# 默认配置
make run-mock RESET=1

# PostgreSQL（会通过 backend/cmd/mockdb 自动 ensure/recreate 数据库）
DB_DRIVER=postgres make run-mock RESET=1
```

`run-mock-sqllite` 与 `run-mock-postgre` 仍保留为兼容别名（已标记废弃）。

## 📖 详细文档

欲了解更多关于架构设计、API 参考及代理接入指南的信息，请访问我们的 **[官方文档站点](https://l-rocket.github.io/EchoCenter/zh/)**。

- [系统架构](/zh/architecture/overview)
- [API 参考](/zh/api/authentication)
- [Agent 接入指南](/zh/development/agent-integration)
- [环境设置](/zh/development/setup)

## 📄 许可证

本项目采用 MIT 许可证。详情请参阅 `LICENSE` 文件。

---

<p align="center">
  由 <a href="https://github.com/L-Rocket">L-Rocket</a> 用 ❤️ 构建
</p>
