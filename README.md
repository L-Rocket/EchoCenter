# EchoCenter 🌐

[English](#english) | [中文](#中文)

---

## English

EchoCenter is a high-performance, professional monitoring hub and command center for local AI Agents. It provides a centralized interface for real-time bi-directional communication, comprehensive status logging, and agent fleet management.

### ✨ Key Features

- **🚀 Real-time Monitoring**: Live system log feed driven by WebSockets for zero-latency updates.
- **💬 Bi-directional Chat**: Engage directly with AI Agents via a WeChat-style persistent chat interface.
- **📂 Persistent History**: All instructions and agent responses are stored in SQLite and survive restarts.
- **🔍 Advanced Filtering**: Deep-dive into logs with multi-dimensional filtering (by Agent, Severity Level) and debounced keyword search.
- **🔒 Secure Access**: JWT-based authentication for operators and unique API tokens for autonomous agents.
- **📱 Responsive Design**: Modern UI built with Shadcn/ui featuring a collapsible sidebar and mobile-optimized layouts.

### 🛠 Tech Stack

- **Backend**: Go (Gin), Gorilla WebSocket, SQLite, JWT.
- **Frontend**: React (TypeScript), Vite, Tailwind CSS, Shadcn/ui, Zustand, React Router.

### 🚀 Quick Start

1.  **Configure Backend**:
    ```bash
    cd backend
    cp .env.example .env
    # Edit .env with your JWT_SECRET and INITIAL_ADMIN credentials
    ```

2.  **Start with Mock Data**:
    ```bash
    ./backend/start_with_mock.sh
    ```

3.  **Launch Frontend**:
    ```bash
    cd frontend
    npm install
    npm run dev
    ```
    Access the dashboard at `http://localhost:5173`.

---

## 中文

EchoCenter 是一个专为本地 AI Agent 设计的高性能、专业级监控中心与指挥部。它为实时的双向通信、详尽的状态日志记录以及 Agent 集群管理提供了一个集中的交互界面。

### ✨ 核心功能

- **🚀 实时监控**：基于 WebSocket 驱动的实时系统日志流，实现零延迟状态更新。
- **💬 双向对话**：通过类似微信的持久化聊天界面，直接与 AI Agent 进行指令交互。
- **📂 历史持久化**：所有指令和 Agent 响应均存储在 SQLite 数据库中，服务器重启后依然可用。
- **🔍 高级检索**：支持多维度日志过滤（按 Agent、严重级别）以及带防抖（Debounce）功能的关键字搜索。
- **🔒 安全准入**：为操作员提供基于 JWT 的身份验证，为 Agent 提供唯一的静态 API Token。
- **📱 响应式布局**：基于 Shadcn/ui 构建的现代化界面，支持侧边栏折叠及移动端适配。

### 🛠 技术栈

- **后端**: Go (Gin), Gorilla WebSocket, SQLite, JWT.
- **前端**: React (TypeScript), Vite, Tailwind CSS, Shadcn/ui, Zustand, React Router.

### 🚀 快速启动

1.  **配置后端**:
    ```bash
    cd backend
    cp .env.example .env
    # 编辑 .env 文件，设置 JWT_SECRET 和初始管理员账号
    ```

2.  **启动并填充 Mock 数据**:
    ```bash
    ./backend/start_with_mock.sh
    ```

3.  **启动前端**:
    ```bash
    cd frontend
    npm install
    npm run dev
    ```
    访问 `http://localhost:5173` 即可进入控制台。

---

### 📄 License

This project is licensed under the [MIT License](LICENSE).
