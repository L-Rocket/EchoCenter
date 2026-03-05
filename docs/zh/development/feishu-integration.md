# 飞书接入指南

## 概述

EchoCenter 支持将飞书作为 Butler 的外部入站消息渠道。

当前后端能力：
- 持久化飞书连接器配置。
- 校验回调可用性。
- 连接器启用/停用（带前置校验）。
- 记录并分页查询连接器日志。
- 接收飞书回调并桥接到 Butler 对话流。
- 通过 `message_id` 做入站去重。

说明：
- `/api/integrations/feishu/:id/test-message` 目前是“验收/记录”接口（暂未真正调用飞书外发消息）。
- 已实现 token 校验；未实现 encrypt_key 解密签名校验。

## 前置条件

- 后端可被飞书平台访问（公网地址或隧道）。
- EchoCenter 管理员账号。
- 已在飞书开放平台创建应用。

本地调试建议（示例）：

```bash
ngrok http 8080
```

假设后端公网地址为：

```text
https://example.your-domain.com
```

## 1. 在 EchoCenter 配置连接器

进入：`Settings -> Integrations -> Feishu Connector`

至少填写：
- `App ID`
- `App Secret`
- `Verification Token`
- 可选：`Encrypt Key`

然后点击 `Save Draft`。

## 2. 在飞书开放平台配置回调

在飞书开放平台中：
- 回调地址配置为：

```text
https://example.your-domain.com/api/integrations/feishu/callback
```

- Verification Token 必须与 EchoCenter 配置一致。
- 订阅你需要的消息事件（私聊/群聊消息事件）。

## 3. 在 EchoCenter 验证回调

在连接器页面点击 `Verify Callback`。

后端接口：

```http
POST /api/integrations/feishu/:id/verify-callback
Authorization: Bearer <admin_jwt>
```

成功响应示例：

```json
{
  "ok": true,
  "message": "callback verified",
  "verified_at": "2026-03-05T22:00:00Z"
}
```

## 4. 启用连接器

回调未验证时，后端会拒绝启用。

```http
PATCH /api/integrations/feishu/:id/enable
Authorization: Bearer <admin_jwt>
Content-Type: application/json

{"enabled": true}
```

## 5. 入站消息路由规则

回调事件到达后，后端会依次检查：
- 连接器已启用。
- token 与 `verification_token` 匹配。
- 非重复消息（`connector_id + message_id` 唯一）。
- 策略过滤：
  - `allow_dm`
  - `allow_group_mention`
  - `mention_required`（群聊）
  - `ignore_bot_messages`
  - `allowed_chat_ids`
  - `user_whitelist`
  - `prefix_command`（配置后必须以前缀开头）

通过后会：
- 创建或复用桥接用户 `feishu_<source_user_id>`。
- 将文本转发到 Butler 的用户消息处理流。

## 6. API 清单

### 公开接口
- `POST /api/integrations/feishu/callback`

### 管理员接口
- `GET /api/integrations/feishu`
- `POST /api/integrations/feishu`
- `PATCH /api/integrations/feishu/:id`
- `POST /api/integrations/feishu/:id/verify-callback`
- `POST /api/integrations/feishu/:id/test-message`
- `PATCH /api/integrations/feishu/:id/enable`
- `GET /api/integrations/feishu/:id/logs?cursor=&limit=20`

## 7. 日志排查

可在页面查看日志，或调用接口：

```http
GET /api/integrations/feishu/:id/logs?limit=20
Authorization: Bearer <admin_jwt>
```

响应示例：

```json
{
  "items": [
    {
      "id": "123",
      "level": "success",
      "action": "callback_routed",
      "detail": "Accepted inbound message om_xxx ...",
      "timestamp": "2026-03-05T22:10:00Z"
    }
  ],
  "cursor": "123"
}
```

## 8. 常见问题

### 回调验证失败
- 回调地址必须指向后端（`:8080`），不是前端（`:5173`）。
- Token 必须完全一致。
- 隧道/公网地址必须可被飞书访问。

### 飞书消息没有进 Butler
- 检查连接器是否启用。
- 检查前缀、@、白名单、聊天范围过滤是否拦截。
- 查看日志中的 `callback_filtered` 原因。

### 重复事件
- 预期行为：同一 `message_id` 重复投递会被去重忽略。

## 9. 安全建议

- 回调地址仅使用 HTTPS。
- 定期轮换 `app_secret` 与 `verification_token`。
- 生产环境建议收紧 `allowed_chat_ids` 与 `user_whitelist`。
- 群聊建议默认开启 `mention_required`。
