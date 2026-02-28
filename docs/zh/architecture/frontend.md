# 前端架构

## 概述

EchoCenter 前端是一个基于 React 的单页应用 (SPA)，使用 TypeScript 开发，并采用 Vite 作为构建工具。

## 技术栈

- **React 18+** - UI 框架
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

## 开发与构建

### 运行开发服务器
```bash
npm run dev
```

### 构建生产版本
```bash
npm run build
```
