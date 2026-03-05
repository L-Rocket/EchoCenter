# API 端点

## 认证

所有受保护接口都需要：

```http
Authorization: Bearer <jwt_token>
```

## 公开端点

### `GET /api/ping`
健康检查。

### `POST /api/auth/login`
登录并获取 JWT。

### `GET /api/ws?token=<jwt_token>`
升级为 WebSocket 连接。

## 受保护端点（任意已登录用户）

### `GET /api/messages`
查询系统/大盘消息。

### `POST /api/messages`
写入系统/大盘消息。

### `GET /api/users/agents`
获取 AGENT + BUTLER 列表。

说明：
- 返回在线态字段（`status`、`online`、`last_seen_at`、`last_report`）。
- **不会**返回明文 `api_token`。
- 可能包含用于展示/审计的 `token_hint` 与 `token_updated_at`。

### `GET /api/users/agents/status`
仅返回 AGENT 的运行状态列表。

### `GET /api/users/butler`
获取 Butler 基本信息与运行状态。

### `GET /api/chat/history/:peer_id`
获取当前用户与 `peer_id` 的聊天历史。

### `GET /api/chat/butler-agent/:agent_id`
获取 Butler 与指定 agent 的持久化会话历史（监控视图使用）。

### `POST /api/chat/auth/response`
响应 Butler 的授权请求。

## 管理员端点

### `POST /api/users`
创建用户。

### `POST /api/users/agents`
注册 Agent。

### `POST /api/users/agents/test-connection`
校验 `api_token` 是否已注册。

### `PATCH /api/users/agents/:id/token`
更新/轮换 Agent Token。

### `GET /api/integrations/feishu`
读取当前飞书连接器配置。

### `POST /api/integrations/feishu`
创建飞书连接器草稿配置。

### `PATCH /api/integrations/feishu/:id`
更新飞书连接器草稿配置。

### `POST /api/integrations/feishu/:id/verify-callback`
验证回调可用性并标记为已验证。

### `POST /api/integrations/feishu/:id/test-message`
创建测试消息请求/日志（后续外发能力挂载点）。

### `PATCH /api/integrations/feishu/:id/enable`
启用/禁用连接器（`enabled=true` 需要先验证回调）。

### `GET /api/integrations/feishu/:id/logs?cursor=&limit=20`
按游标分页查询连接器日志。

## 开发 Mock 端点（仅管理员 + 非生产环境）

### `POST /api/dev/mock/reset`
重置 mock 数据。

### `POST /api/dev/mock/chat`
插入 mock 聊天记录。

### `GET /api/dev/mock/agent-token/:username`
按用户名获取原始 Agent Token（用于本地启动脚本）。

## 公开集成回调端点

### `POST /api/integrations/feishu/callback`
飞书事件回调入口（无需 JWT）。
