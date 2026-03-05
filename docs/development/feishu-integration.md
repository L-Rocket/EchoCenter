# Feishu Integration

## Overview

EchoCenter supports Feishu as an external inbound channel for Butler.

Current backend capabilities:
- Persist Feishu connector config.
- Verify callback readiness.
- Enable/disable connector with guard checks.
- Store connector logs and expose paginated timeline.
- Accept Feishu callback events and bridge inbound text to Butler flow.
- De-duplicate inbound events by Feishu `message_id`.

Notes:
- `/api/integrations/feishu/:id/test-message` is currently an acceptance/logging endpoint (no real Feishu outbound send yet).
- Callback token validation is implemented; encrypt-key decryption/signature validation is not implemented yet.

## Prerequisites

- Backend reachable from Feishu platform (public URL or tunnel).
- Admin account in EchoCenter.
- Feishu app created in Feishu Open Platform.

Recommended local tunnel:

```bash
ngrok http 8080
```

Assume public backend base URL is:

```text
https://example.your-domain.com
```

## 1. Configure Connector in EchoCenter

Go to: `Settings -> Integrations -> Feishu Connector`.

Fill at least:
- `App ID`
- `App Secret`
- `Verification Token`
- Optional: `Encrypt Key`

Then click `Save Draft`.

## 2. Configure Feishu Event Callback

In Feishu Open Platform:
- Set callback URL:

```text
https://example.your-domain.com/api/integrations/feishu/callback
```

- Set verification token to match EchoCenter config.
- Subscribe to message events needed by your app (DM/group message events).

## 3. Verify Callback in EchoCenter

In EchoCenter connector page, click `Verify Callback`.

Backend API:

```http
POST /api/integrations/feishu/:id/verify-callback
Authorization: Bearer <admin_jwt>
```

Expected success response:

```json
{
  "ok": true,
  "message": "callback verified",
  "verified_at": "2026-03-05T22:00:00Z"
}
```

## 4. Enable Connector

Enable is blocked before callback verification.

```http
PATCH /api/integrations/feishu/:id/enable
Authorization: Bearer <admin_jwt>
Content-Type: application/json

{"enabled": true}
```

## 5. Message Routing Rules (Inbound)

When callback events arrive, backend checks:
- Connector enabled.
- Token matches `verification_token`.
- Event not duplicated (`connector_id + message_id` unique).
- Scope policy:
  - `allow_dm`
  - `allow_group_mention`
  - `mention_required` (group)
  - `ignore_bot_messages`
  - `allowed_chat_ids`
  - `user_whitelist`
  - `prefix_command` (if set, inbound text must start with it)

If accepted:
- Backend creates/uses bridge user `feishu_<source_user_id>`.
- Message is forwarded into Butler user-message flow.

## 6. API Checklist

### Public
- `POST /api/integrations/feishu/callback`

### Admin
- `GET /api/integrations/feishu`
- `POST /api/integrations/feishu`
- `PATCH /api/integrations/feishu/:id`
- `POST /api/integrations/feishu/:id/verify-callback`
- `POST /api/integrations/feishu/:id/test-message`
- `PATCH /api/integrations/feishu/:id/enable`
- `GET /api/integrations/feishu/:id/logs?cursor=&limit=20`

## 7. Log Inspection

Use UI log table or query API:

```http
GET /api/integrations/feishu/:id/logs?limit=20
Authorization: Bearer <admin_jwt>
```

Response:

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

## 8. Troubleshooting

### Callback verify fails
- Ensure Feishu callback URL points to backend (`:8080`), not frontend (`:5173`).
- Ensure token matches exactly.
- Ensure tunnel/public endpoint is reachable from Feishu.

### Messages not routed to Butler
- Check connector is enabled.
- Check prefix/mention/scope filters are not blocking.
- Check logs for `callback_filtered` reasons.

### Duplicate events
- Expected behavior: duplicates by same `message_id` are ignored.

## 9. Security Recommendations

- Use HTTPS callback endpoint only.
- Rotate `app_secret` and `verification_token` periodically.
- Restrict scope with `allowed_chat_ids` and `user_whitelist`.
- Keep `mention_required` enabled for group channels unless explicitly needed otherwise.
