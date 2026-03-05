# Backend Pending For Frontend

Last updated: 2026-03-05

## TODO APIs

1. Butler direct endpoint
- Suggested: `GET /api/users/butler`
- Purpose: return Butler user directly, so frontend does not need to scan `/api/users/agents`.

2. Agent list filtering on server
- Suggested: `GET /api/users/agents?exclude_role=BUTLER`
- Purpose: keep `Agents` page clean without frontend-side role filtering.

3. Butler-agent conversation visibility
- Suggested: `GET /api/chat/butler-agent/:agent_id` (or equivalent query on chat history)
- Purpose: expose Butler <-> Agent execution conversation/history for auditing UI.
- Current gap: existing chat history API is user-peer based, and Butler-Agent traffic is not fully available as direct history.
- Frontend now added: Butler page "Agent Dialogue Monitor" and currently falls back to local-derived/mock data when endpoint is unavailable.
- Response contract (recommended): same shape as current `ChatMessage[]` used by frontend (`id`, `type`, `sender_id`, `sender_role`, `payload`, `timestamp`, optional `sender_name`).

4. Create agent with caller-provided token
- Suggested: `POST /api/users/agents` should accept and persist `api_token` when provided.
- Purpose: frontend Add Agent form now supports token generation and token-based onboarding workflow.
- Current gap: backend currently auto-generates token and does not persist the frontend-provided token.

5. Agent connection test API
- Suggested: `POST /api/users/agents/test-connection` with `{ api_token }`.
- Purpose: test whether token can pass backend handshake before/after provisioning.
- Current frontend fallback: direct WebSocket handshake probe from browser.

6. Agent online status endpoint
- Suggested: `GET /api/users/agents/status` (or include `online`, `last_seen_at` in `GET /api/users/agents`).
- Purpose: reliable online/offline status in agent list.
- Current frontend fallback: infer status from recent dialogue activity, which is only approximate.

7. Update existing agent token
- Suggested: `PATCH /api/users/agents/:id/token` with `{ api_token }`.
- Purpose: allow token rotation/edit after agent creation from Agent Operations page.
- Current frontend fallback: token edits are stored in UI state only when API is unavailable.

8. Return token metadata in agent list
- Suggested: `GET /api/users/agents` should include at least `token_hint` or `token_updated_at`.
- Purpose: help operators audit whether a token was configured without exposing full secret by default.
- Current frontend gap: list cannot tell if backend has persisted token after reload.

9. Agent list pagination/search on server
- Suggested: `GET /api/users/agents?page=1&limit=20&q=keyword`
- Purpose: prevent large management list payloads and support scalable pagination/search.
- Current frontend fallback: client-side pagination over full list.

10. Butler-agent monitor streaming event
- Suggested: WebSocket event `BUTLER_AGENT_MESSAGE` with payload `{ agent_id, type, sender_id, sender_role, sender_name, payload, timestamp, id? }`.
- Purpose: update Butler monitor timeline in real time without polling.
- Current frontend fallback: manual refresh + local chat-store derived timeline + mock seed.

## Feishu Integration APIs (New)

11. Read Feishu connector config
- Suggested: `GET /api/integrations/feishu`
- Purpose: hydrate Team > Integrations page with persisted connector fields.
- Response contract (recommended):
  - `id`, `connector_name`, `enabled`, `status`
  - `app_id`, `verification_token`, `encrypt_key` (secret fields can return masked value + `has_secret`)
  - `allow_dm`, `allow_group_mention`, `mention_required`, `prefix_command`, `ignore_bot_messages`, `rate_limit_per_minute`
  - `allowed_chat_ids[]`, `user_whitelist[]`
  - `callback_url`, `callback_verified`, `last_verified_at`
- Frontend note: status badge uses `not_connected | connecting | connected | error`.

12. Save Feishu connector draft
- Suggested: `POST /api/integrations/feishu` (create) and `PATCH /api/integrations/feishu/:id` (update)
- Purpose: persist form data even if callback is not verified yet.
- Validation notes:
  - allow saving draft without enable.
  - do not echo plaintext secret back in response.
  - keep unknown fields ignored (forward-compatible).

13. Verify Feishu callback endpoint
- Suggested: `POST /api/integrations/feishu/:id/verify-callback`
- Purpose: active probe for callback URL + token/key correctness before enabling.
- Response contract (recommended): `{ ok: boolean, message: string, verified_at?: string }`.
- Frontend behavior: `Save & Enable` is blocked until `ok === true`.

14. Send Feishu test message
- Suggested: `POST /api/integrations/feishu/:id/test-message`
- Purpose: validate outbound delivery and routing into Butler pipeline.
- Request example: `{ target_chat_id?: string, text?: string }`
- Response contract (recommended): `{ ok: boolean, message: string, trace_id?: string }`.

15. Enable/disable connector
- Suggested: `PATCH /api/integrations/feishu/:id/enable` with `{ enabled: boolean }`
- Purpose: explicit runtime switch without rewriting full config.
- Validation notes:
  - enabling requires callback verified.
  - disabling should be immediate and idempotent.

16. Connector logs for UI timeline
- Suggested: `GET /api/integrations/feishu/:id/logs?cursor=&limit=20`
- Purpose: power "Test & Logs" table in frontend.
- Response contract (recommended):
  - list item: `{ id, level, action, detail, timestamp }`
  - cursor-based pagination.

17. Feishu inbound event bridge to Butler
- Suggested: backend should consume Feishu webhook events and normalize into chat events routed to Butler conversation flow.
- Purpose: allow users to talk to Butler directly from Feishu DM/group mentions.
- Mapping notes:
  - preserve source metadata (`feishu_user_id`, `chat_id`, `message_id`, `is_group`, `mentioned`).
  - de-duplicate by Feishu message id.
  - apply scope rules from connector config before routing.

## Notes

- Current frontend branch already supports separate Butler page (`/butler`) and excludes Butler from Agents UI.
- Agent creation and token management UI is now on Team/Admin page; Agents page is chat-focused with search only.
- These backend APIs are not required for current UI to run, but are required for cleaner data flow and richer history views.
