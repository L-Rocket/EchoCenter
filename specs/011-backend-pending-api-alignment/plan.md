# Implementation Plan: Backend Pending API Alignment (Non-Feishu)

## Summary
Implement backend APIs required by `frontend/BACKEND_PENDING.md` except Feishu integration.
This plan focuses on agent/butler management, conversation visibility, status/metadata, and mock data richness.

## Scope
- In scope (from TODO APIs 1-10):
  1. `GET /api/users/butler`
  2. `GET /api/users/agents` with `exclude_role` filtering
  3. `GET /api/chat/butler-agent/:agent_id`
  4. `POST /api/users/agents` accepts caller token
  5. `POST /api/users/agents/test-connection`
  6. `GET /api/users/agents/status`
  7. `PATCH /api/users/agents/:id/token`
  8. Token metadata in agent list (`token_hint`, `token_updated_at`)
  9. Agent list `page/limit/q` query support
  10. WebSocket `BUTLER_AGENT_MESSAGE` event for monitor stream
- Out of scope:
  - Feishu integration APIs (items 11-17)

## Technical Context
- Backend: Go + Gin + repository abstraction
- Existing frontend already calls endpoints for token test/update and Butler monitor.
- Current branch already added initial dashboard filtering and butler-agent history endpoint scaffolding.

## Delivery Strategy
1. Complete REST API alignment first (items 1-9).
2. Add WS monitor event (item 10) with minimal payload contract.
3. Expand `seed_mock_data.sh` so dashboard and monitor are directly usable after `make run-mock RESET=1`.
4. Verify with `go test ./...` and script syntax checks.

## Risks and Mitigations
- Risk: expanding `User` response fields breaks frontend assumptions.
  - Mitigation: keep existing fields unchanged; only add optional fields.
- Risk: token storage transition may leak full token in listing.
  - Mitigation: list API returns `token_hint` instead of plaintext token.
- Risk: WS event recursion/duplication.
  - Mitigation: emit monitor event as separate lightweight broadcast payload; do not re-feed into chat persistence path.
