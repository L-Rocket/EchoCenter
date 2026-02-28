# API 端点

## 概述

EchoCenter 提供了一系列 RESTful API 端点，用于管理用户、代理和消息。

## 认证

所有 API 请求（除登录和注册外）都必须在 `Authorization` 头中包含有效的 JWT 令牌。

```
Authorization: Bearer <your_token>
```

## 用户 API

### 获取用户列表
`GET /api/users`

### 获取用户详情
`GET /api/users/:id`

### 注册代理
`POST /api/users/agents`

### 删除代理
`DELETE /api/users/agents/:id`

## 消息 API

### 获取消息历史
`GET /api/messages`

### 发送消息
`POST /api/messages`

## 系统 API

### 检查系统状态
`GET /api/ping`
