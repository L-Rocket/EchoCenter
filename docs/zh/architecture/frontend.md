# 前端架构

## 概述

EchoCenter 前端是一个基于 React 的单页应用 (SPA)，使用 TypeScript 开发，并采用 Vite 作为构建工具。

## 技术栈

- **React 19** - UI 框架
- **TypeScript** - 类型安全
- **Tailwind CSS** - 样式框架
- **shadcn/ui** - UI 组件库
- **Lucide React** - 图标库
- **Zustand** - 状态管理
- **React Router** - 路由管理
- **TanStack Query** - 数据获取和同步 (可选)

## 目录结构

```
frontend/
├── src/
│   ├── assets/         # 静态资源
│   ├── components/     # 公共组件
│   ├── context/        # React Context
│   ├── hooks/          # 自定义 Hooks
│   ├── lib/            # 工具函数和库配置
│   ├── pages/          # 页面组件
│   ├── store/          # Zustand 状态存储
│   ├── types/          # TypeScript 类型定义
│   └── App.tsx         # 根组件
└── vite.config.ts      # Vite 配置
```

## 核心概念

### 1. 状态管理
使用 Zustand 进行轻量级的全局状态管理，主要用于存储用户信息、消息列表和系统设置。

### 2. 实时通信
通过 WebSocket 与后端进行双向通信。前端实现了一个 `useWebSocket` hook 来处理连接、重连和消息分发。

### 3. UI 组件
基于 `shadcn/ui` 构建，遵循一致的设计规范，支持响应式布局和深色模式。

### 4. 数据同步与乐观更新
- **本地乐观写入**：发送消息时立即写入本地会话，并带 `local_id`。
- **去重与替换**：收到后端回声（人类发送者）后按 `local_id`/`stream_id` 对齐并替换为权威记录（含数据库 `id`）。
- **会话级等待态**：等待状态按 `peer_id` 维护（`pendingByPeer`），避免不同聊天窗口互相干扰。

### 5. 国际化（i18n）
- 全局语言状态由 `I18nContext` 提供。
- 用户可在顶部导航切换英文 / 简体中文。
- 语言偏好持久化在 `localStorage`（`echocenter-locale`），并同步到 `document.documentElement.lang`。

### 6. 管理工作台
- 侧边栏管理员入口统一为 **Settings**。
- Settings 下包含两个操作面板：
  - **Agent Operations**：创建 agent、刷新/删除 token、检查连通性。
  - **Integrations**：配置飞书等外部渠道并路由消息到 Butler。

### 7. Butler 工作台
- **Me ↔ Butler**：与 Butler 的一对一直连通道。
- **Butler ↔ Agents**：监控 Butler 分发时间线与跨 agent 协作过程。
- 当监控历史为空时，显示静态空态 `No Monitor Messages`（不显示转圈）。

## 开发与构建

### 运行开发服务器
```bash
npm run dev
```

### 构建生产版本
```bash
npm run build
```
