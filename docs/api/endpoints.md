# API Endpoints

## Authentication

All protected endpoints require:

```http
Authorization: Bearer <jwt_token>
```

## Public Endpoints

### `GET /api/ping`
Health check.

### `POST /api/auth/login`
Login and obtain JWT.

### `GET /api/ws?token=<jwt_token>`
Upgrade to WebSocket.

## Protected Endpoints (Any Authenticated User)

### `GET /api/messages`
Query dashboard/system messages.

### `POST /api/messages`
Ingest dashboard/system message.

### `GET /api/users/agents`
Get AGENT + BUTLER list.

Notes:
- Returns presence fields (`status`, `online`, `last_seen_at`, `last_report`).
- Does **not** expose raw `api_token`.
- May include `token_hint` and `token_updated_at` for display/audit.

### `GET /api/users/agents/status`
Get runtime status list for AGENT users only.

### `GET /api/users/butler`
Get Butler profile and runtime status.

### `GET /api/chat/history/:peer_id`
Get chat history between current user and `peer_id`.

### `GET /api/chat/butler-agent/:agent_id`
Get persisted Butler-agent conversation history for monitor view.

### `POST /api/chat/auth/response`
Reply to Butler authorization request.

## Admin Endpoints

### `POST /api/users`
Create user.

### `POST /api/users/agents`
Register agent.

### `POST /api/users/agents/test-connection`
Validate whether an `api_token` is registered.

### `PATCH /api/users/agents/:id/token`
Rotate/update agent token.

### `GET /api/integrations/feishu`
Get current Feishu connector config.

### `POST /api/integrations/feishu`
Create Feishu connector config draft.

### `PATCH /api/integrations/feishu/:id`
Update Feishu connector config draft.

### `POST /api/integrations/feishu/:id/verify-callback`
Verify connector credentials against Feishu auth API and mark connector as verified.

### `POST /api/integrations/feishu/:id/test-message`
Create a test-message request/log entry (outbound delivery hook point).

### `PATCH /api/integrations/feishu/:id/enable`
Enable/disable connector (`enabled=true` requires callback verified).

### `GET /api/integrations/feishu/:id/logs?cursor=&limit=20`
Query connector logs with cursor pagination.

## Dev Mock Endpoints (Admin + Non-production Only)

### `POST /api/dev/mock/reset`
Reset mock data.

### `POST /api/dev/mock/chat`
Insert mock chat record.

### `GET /api/dev/mock/agent-token/:username`
Get raw agent token for local bootstrap scripts.

## Feishu Ingress Note

Feishu ingress is handled by long-connection WebSocket mode (`FEISHU_WS_ENABLED=true`).
