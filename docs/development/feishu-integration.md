# Feishu Integration

## Overview

EchoCenter integrates Feishu in **long-connection WebSocket mode**.

Current implemented capabilities:
- Feishu connector config persistence (`app_id`, `app_secret`, filters, allow-list).
- Credential verification via Feishu auth API (`tenant_access_token/internal`).
- Inbound Feishu text message routing into Butler flow.
- Butler outbound reply relay back to Feishu.
- Butler authorization request cards in Feishu (`Approve` / `Reject`).
- Card action callback handling for command approval decisions.

## Important Mode Notes

- Message ingestion uses `FEISHU_WS_ENABLED=true` + `FEISHU_WS_URL`.
- This mode does **not** require exposing `/api/integrations/feishu/callback` publicly for normal message ingress.
- If your tenant policy enforces callback URL checks for specific card features, ensure platform config is aligned with your deployment setup.

## 1. Configure Connector (EchoCenter Admin)

In `Settings -> Integrations -> Feishu Connector`, save:
- `App ID`
- `App Secret`
- Optional `Verification Token` / `Encrypt Key`
- Optional `allowed_chat_ids` for outbound target restriction

## 2. Verify Connector

Call:

```http
POST /api/integrations/feishu/:id/verify-callback
Authorization: Bearer <admin_jwt>
```

Behavior:
- Backend calls Feishu auth API with `app_id/app_secret`.
- Only successful Feishu response marks connector `callback_verified=true`.

## 3. Enable Connector

```http
PATCH /api/integrations/feishu/:id/enable
Authorization: Bearer <admin_jwt>
Content-Type: application/json

{"enabled": true}
```

`enabled=true` is rejected until verification succeeds.

## 4. Inbound Routing Rules

Incoming Feishu messages are accepted only when:
- Connector is enabled.
- Not deduplicated by same `message_id`.
- Policy filters pass (`allow_dm`, `allow_group_mention`, `mention_required`, `allowed_chat_ids`, `user_whitelist`, `prefix_command`, `ignore_bot_messages`).

## 5. Butler Authorization Cards in Feishu

When Butler emits an `AUTH_REQUEST`, backend sends an interactive Feishu card:
- `Approve`
- `Reject`

Card action callback result:
- Executes `ExecutePendingCommand` on approve.
- Marks request rejected on reject.
- Card is collapsed to decision state; repeated clicks are idempotent.

## 6. Troubleshooting

### No inbound message reaches Butler
- Check connector `enabled` state.
- Check `ws_filtered` logs for reason (`prefix_not_matched`, allow-list mismatch, mention rules).

### Butler outbound not sent to Feishu
- Check connector has valid `app_id/app_secret`.
- Check outbound target resolution (`allowed_chat_ids` or latest inbound chat/user).
- Check `ws_outbound` logs.

### Card approve/reject not effective
- Ensure Feishu card callback events are enabled in app config.
- Check integration logs for `ws_auth_card` / `ws_auth_card_decision`.

## 7. Related APIs

- `GET /api/integrations/feishu`
- `POST /api/integrations/feishu`
- `PATCH /api/integrations/feishu/:id`
- `POST /api/integrations/feishu/:id/verify-callback`
- `PATCH /api/integrations/feishu/:id/enable`
- `GET /api/integrations/feishu/:id/logs`
