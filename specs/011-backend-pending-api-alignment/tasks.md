# Tasks: Backend Pending API Alignment (Non-Feishu)

## Phase 1: REST Endpoints
- [x] T1 Add `GET /api/users/butler` and handler.
- [x] T2 Extend `GET /api/users/agents` to support `exclude_role`, `q`, `page`, `limit`.
- [x] T3 Ensure `GET /api/chat/butler-agent/:agent_id` returns `ChatMessage[]` used by frontend.
- [x] T4 Add `POST /api/users/agents/test-connection`.
- [x] T5 Add `PATCH /api/users/agents/:id/token`.
- [x] T6 Add `GET /api/users/agents/status`.

## Phase 2: Repository/Data Support
- [x] T7 Add repository method to update agent token and keep credentials table in sync.
- [x] T8 Return token metadata (`token_hint`, `token_updated_at`) in agent list payload.

## Phase 3: WebSocket Monitor Event
- [x] T9 Emit `BUTLER_AGENT_MESSAGE` when Butler dispatches to agent.
- [x] T10 Emit `BUTLER_AGENT_MESSAGE` when agent replies to Butler.

## Phase 4: Mock Data
- [x] T11 Enrich dashboard mock logs.
- [x] T12 Seed Butler-Agent monitor conversation data.

## Phase 5: Validation
- [x] T13 Run formatting, backend tests, and script syntax checks.
