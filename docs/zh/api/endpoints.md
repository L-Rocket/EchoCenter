# API 端点

## 概述

EchoCenter 提供了一系列 RESTful API 端点，用于管理用户、代理和消息。

## 认证

所有 API 请求（除登录和注册外）都必须在 `Authorization` 头中包含有效的 JWT 令牌。

```
Authorization: Bearer <your_token>
```

## 用户 / Agent API

### 获取 Agent 列表
`GET /api/users/agents`

### 创建用户（管理员）
`POST /api/users`

### 注册 Agent（管理员）
`POST /api/users/agents`

## 聊天 API

### 按会话对象获取聊天历史
`GET /api/chat/history/:peer_id`

### 响应授权请求
`POST /api/chat/auth/response`

## 开发 Mock API（非生产 + 管理员）

### 重置 Mock 数据
`POST /api/dev/mock/reset`

### 插入 Mock 聊天记录
`POST /api/dev/mock/chat`

### 按用户名获取 Agent Token
`GET /api/dev/mock/agent-token/:username`

## 消息 API

### 获取消息历史
`GET /api/messages`

### 发送消息
`POST /api/messages`

## 系统 API

### 检查系统状态
`GET /api/ping`
