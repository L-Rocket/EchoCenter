# 飞书接入指南

## 概述

EchoCenter 当前使用 **飞书长连接 WebSocket 模式** 接入。

已实现能力：
- 飞书连接器配置持久化（`app_id`、`app_secret`、过滤规则、白名单）。
- 通过飞书鉴权接口验证凭据（`tenant_access_token/internal`）。
- 飞书入站文本路由到 Butler。
- Butler 回复外发回飞书。
- Butler 授权请求在飞书内以卡片展示（批准/拒绝）。
- 卡片动作回调后执行授权命令。

## 模式说明

- 消息入站依赖 `FEISHU_WS_ENABLED=true` 与 `FEISHU_WS_URL`。
- 常规消息接入不再依赖公网 `POST /api/integrations/feishu/callback`。
- 若你的租户策略对卡片回调有额外要求，请按飞书后台能力配置项补齐事件订阅与回调策略。

## 1. 在 EchoCenter 配置连接器

进入 `Settings -> Integrations -> Feishu Connector`，至少保存：
- `App ID`
- `App Secret`
- 可选：`Verification Token`、`Encrypt Key`
- 可选：`allowed_chat_ids`（限制外发目标）

## 2. 验证连接器

调用：

```http
POST /api/integrations/feishu/:id/verify-callback
Authorization: Bearer <admin_jwt>
```

行为：
- 后端使用 `app_id/app_secret` 调用飞书鉴权接口。
- 只有飞书返回成功才会把 `callback_verified` 标记为 `true`。

## 3. 启用连接器

```http
PATCH /api/integrations/feishu/:id/enable
Authorization: Bearer <admin_jwt>
Content-Type: application/json

{"enabled": true}
```

未验证时启用会被拒绝。

## 4. 入站路由规则

飞书消息要被接收，需满足：
- 连接器已启用。
- `message_id` 未去重命中。
- 通过策略过滤（`allow_dm`、`allow_group_mention`、`mention_required`、`allowed_chat_ids`、`user_whitelist`、`prefix_command`、`ignore_bot_messages`）。

## 5. 飞书内授权卡片

当 Butler 产生 `AUTH_REQUEST` 时，后端会发授权卡片（`Approve` / `Reject`）到飞书。

卡片点击后：
- 批准：执行 `ExecutePendingCommand`。
- 拒绝：标记拒绝，不执行。
- 卡片会收敛为结果态，并做幂等处理（重复点击不会重复执行）。

## 6. 排查建议

### 飞书消息没有进 Butler
- 检查连接器是否启用。
- 查看 `ws_filtered` 日志原因（如 `prefix_not_matched`、白名单不匹配、@ 规则拦截）。

### Butler 没有回消息到飞书
- 检查 `app_id/app_secret` 是否有效。
- 检查外发目标解析（`allowed_chat_ids` 或最近入站 chat/user）。
- 查看 `ws_outbound` 日志。

### 卡片批准/拒绝不生效
- 确认飞书后台已启用卡片动作相关事件。
- 查看日志 `ws_auth_card` / `ws_auth_card_decision`。

## 7. 相关接口

- `GET /api/integrations/feishu`
- `POST /api/integrations/feishu`
- `PATCH /api/integrations/feishu/:id`
- `POST /api/integrations/feishu/:id/verify-callback`
- `PATCH /api/integrations/feishu/:id/enable`
- `GET /api/integrations/feishu/:id/logs`
