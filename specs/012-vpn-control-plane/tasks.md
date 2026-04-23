# Tasks: VPN Control Plane MVP

**Input**: Design documents from `/specs/012-vpn-control-plane/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/vpn-admin-api.yaml, quickstart.md

**Tests**: Tests are required for security boundaries, key redaction, repository behavior, peer lifecycle, config generation, and runtime placeholder semantics.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated independently after the foundational phase.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4, US5)
- Include exact file paths in descriptions

## Path Conventions

- **Backend**: `backend/internal/`, `backend/pkg/`, `backend/cmd/`, `backend/scripts/`
- **Contracts**: `specs/012-vpn-control-plane/contracts/`
- **Docs/Validation**: `specs/012-vpn-control-plane/quickstart.md`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the VPN feature work areas and keep the generated contract available to implementation.

- [ ] T001 Create VPN domain package directory and placeholder file in `backend/internal/vpn/doc.go`
- [ ] T002 [P] Create VPN handler placeholder file in `backend/internal/api/handler/vpn.go`
- [ ] T003 [P] Create VPN repository placeholder file in `backend/internal/repository/vpn_store.go`
- [ ] T004 [P] Create VPN domain test placeholder file in `backend/internal/vpn/service_test.go`
- [ ] T005 [P] Create VPN handler test placeholder file in `backend/internal/api/handler/vpn_test.go`
- [ ] T006 [P] Create VPN repository test placeholder file in `backend/internal/repository/vpn_store_test.go`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish shared types, config, persistence, and service skeletons required by every user story.

**CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T007 Add VPN environment configuration fields and validation defaults in `backend/internal/config/config.go`
- [ ] T008 [P] Add VPN model and request/response DTO structs in `backend/internal/models/models.go`
- [ ] T009 Add SQLite and PostgreSQL migrations for `vpn_networks` and `vpn_peers` in `backend/internal/repository/migrations.go`
- [ ] T010 Extend repository interfaces with VPN network and peer operations in `backend/internal/repository/repository.go`
- [ ] T011 Implement reusable secret encryption helper extracted from SSH key storage in `backend/internal/repository/secret_store.go`
- [ ] T012 Update SSH key storage to use the shared secret helper in `backend/internal/repository/ops_store.go`
- [ ] T013 Implement VPN repository create/read/update/delete primitives in `backend/internal/repository/vpn_store.go`
- [ ] T014 [P] Add repository tests for VPN migrations, uniqueness constraints, and secret ciphertext storage in `backend/internal/repository/vpn_store_test.go`
- [ ] T015 Implement VPN service constructor and dependency wiring skeleton in `backend/internal/vpn/service.go`
- [ ] T016 Register admin-only `/api/vpn` route group skeleton in `backend/internal/api/router/router.go`
- [ ] T017 Thread VPN service/config dependencies into handler construction in `backend/internal/api/handler/handler.go`

**Checkpoint**: VPN config, durable storage, service skeleton, and admin route skeleton exist.

---

## Phase 3: User Story 1 - Configure Default VPN Network (Priority: P1) MVP

**Goal**: Administrators can retrieve the configured default VPN network and feature enabled state without host network side effects.

**Independent Test**: Start with VPN env settings and verify `GET /api/vpn/status` returns network name, interface name, CIDR, server VPN IP, listen port, domain, enabled state, and hosts guidance with no TUN/route/DNS changes.

### Tests for User Story 1

- [ ] T018 [P] [US1] Add config validation tests for valid and malformed VPN env settings in `backend/internal/config/config_test.go`
- [ ] T019 [P] [US1] Add VPN network bootstrap/status service tests in `backend/internal/vpn/service_test.go`
- [ ] T020 [P] [US1] Add admin status handler tests for auth and network fields in `backend/internal/api/handler/vpn_test.go`

### Implementation for User Story 1

- [ ] T021 [US1] Implement default VPN network bootstrap from config in `backend/internal/vpn/service.go`
- [ ] T022 [US1] Implement VPN network repository upsert/load methods in `backend/internal/repository/vpn_store.go`
- [ ] T023 [US1] Implement `GET /api/vpn/status` handler response without private key fields in `backend/internal/api/handler/vpn.go`
- [ ] T024 [US1] Wire `GET /api/vpn/status` to admin-only route group in `backend/internal/api/router/router.go`
- [ ] T025 [US1] Add startup-safe VPN initialization call in `backend/internal/api/handler/handler.go`

**Checkpoint**: User Story 1 is independently testable with `GET /api/vpn/status`.

---

## Phase 4: User Story 2 - Initialize And Protect Server Keys (Priority: P1)

**Goal**: EchoCenter generates, stores, and exposes only safe server key material.

**Independent Test**: Initialize VPN state and confirm server public key is present while server private key is absent from status, peer views, configs, logs, and errors.

### Tests for User Story 2

- [ ] T026 [P] [US2] Add WireGuard-compatible key generation and validation tests in `backend/internal/vpn/keys_test.go`
- [ ] T027 [P] [US2] Add server private key encryption/decryption tests in `backend/internal/repository/vpn_store_test.go`
- [ ] T028 [P] [US2] Add server private key redaction tests for status responses in `backend/internal/api/handler/vpn_test.go`

### Implementation for User Story 2

- [ ] T029 [US2] Implement WireGuard-compatible key generation and public key derivation in `backend/internal/vpn/keys.go`
- [ ] T030 [US2] Implement server key initialization and idempotent preservation in `backend/internal/vpn/service.go`
- [ ] T031 [US2] Persist encrypted server private key and public key in `backend/internal/repository/vpn_store.go`
- [ ] T032 [US2] Ensure status serialization exposes `server_public_key` only in `backend/internal/api/handler/vpn.go`
- [ ] T033 [US2] Add secret-safe admin action logging for server key initialization in `backend/internal/vpn/service.go`

**Checkpoint**: User Story 2 is independently testable through VPN initialization and status redaction checks.

---

## Phase 5: User Story 3 - Create And Manage VPN Peers (Priority: P1)

**Goal**: Administrators can create, list, view, update, enable/disable, and delete VPN peers with unique virtual IPs and safe defaults.

**Independent Test**: Create peers in generated-key and external-key modes, verify unique virtual IP assignment/defaults, list/view them, disable one, delete one, and confirm other peers are unaffected.

### Tests for User Story 3

- [ ] T034 [P] [US3] Add peer IP allocation, duplicate, and pool exhaustion tests in `backend/internal/vpn/ipam_test.go`
- [ ] T035 [P] [US3] Add peer lifecycle repository tests for create/list/get/update/delete in `backend/internal/repository/vpn_store_test.go`
- [ ] T036 [P] [US3] Add peer admin API tests for create/list/get/patch/delete and non-admin rejection in `backend/internal/api/handler/vpn_test.go`

### Implementation for User Story 3

- [ ] T037 [US3] Implement CIDR parsing and deterministic peer IP allocation in `backend/internal/vpn/ipam.go`
- [ ] T038 [US3] Implement peer validation for names, public keys, optional Agent/User IDs, and defaults in `backend/internal/vpn/service.go`
- [ ] T039 [US3] Implement peer CRUD repository methods with unique name/public key/virtual IP handling in `backend/internal/repository/vpn_store.go`
- [ ] T040 [US3] Implement `GET /api/vpn/peers` and `POST /api/vpn/peers` handlers in `backend/internal/api/handler/vpn.go`
- [ ] T041 [US3] Implement `GET /api/vpn/peers/:id`, `PATCH /api/vpn/peers/:id`, and `DELETE /api/vpn/peers/:id` handlers in `backend/internal/api/handler/vpn.go`
- [ ] T042 [US3] Wire peer management routes to admin-only route group in `backend/internal/api/router/router.go`
- [ ] T043 [US3] Add secret-safe audit logs for peer create/update/delete/config-relevant actions in `backend/internal/vpn/service.go`

**Checkpoint**: User Story 3 is independently testable through peer lifecycle API calls.

---

## Phase 6: User Story 4 - Generate Peer Connection Material (Priority: P2)

**Goal**: Administrators can retrieve complete config for server-generated peers and setup fragments/guidance for external-key peers.

**Independent Test**: Generate config for both peer modes and confirm the material contains the expected WireGuard sections, Agent WebSocket URL, hosts entry, warnings, and no server private key.

### Tests for User Story 4

- [ ] T044 [P] [US4] Add WireGuard config rendering tests for full and fragment modes in `backend/internal/vpn/config_test.go`
- [ ] T045 [P] [US4] Add peer config endpoint redaction and disabled/deleted peer tests in `backend/internal/api/handler/vpn_test.go`

### Implementation for User Story 4

- [ ] T046 [US4] Implement WireGuard client config and server fragment rendering in `backend/internal/vpn/config.go`
- [ ] T047 [US4] Implement peer private key decrypt path only for matching server-generated peers in `backend/internal/repository/vpn_store.go`
- [ ] T048 [US4] Implement `GET /api/vpn/peers/:id/config` handler with warnings and guidance in `backend/internal/api/handler/vpn.go`
- [ ] T049 [US4] Wire peer config route to admin-only route group in `backend/internal/api/router/router.go`
- [ ] T050 [US4] Update `specs/012-vpn-control-plane/quickstart.md` with any final response field names from implementation

**Checkpoint**: User Story 4 is independently testable through config generation API calls.

---

## Phase 7: User Story 5 - Read Control-Plane Runtime Status (Priority: P2)

**Goal**: Administrators can read stable runtime status fields with unknown/null values until live runtime integration exists.

**Independent Test**: Retrieve status and peer details and confirm each peer includes enabled state, virtual IP, last handshake, rx bytes, tx bytes, and runtime source without invented zero metrics.

### Tests for User Story 5

- [ ] T051 [P] [US5] Add runtime placeholder serialization tests in `backend/internal/vpn/service_test.go`
- [ ] T052 [P] [US5] Add status/list/detail handler tests for `runtime.source=unknown` and null metrics in `backend/internal/api/handler/vpn_test.go`

### Implementation for User Story 5

- [ ] T053 [US5] Add runtime status DTO mapping with unknown/null semantics in `backend/internal/vpn/service.go`
- [ ] T054 [US5] Include peer runtime fields in status, list, and detail responses in `backend/internal/api/handler/vpn.go`
- [ ] T055 [US5] Ensure database scan/write paths preserve nullable runtime fields in `backend/internal/repository/vpn_store.go`

**Checkpoint**: User Story 5 is independently testable through status/list/detail API responses.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Validate the full control-plane MVP and keep documentation/contracts aligned.

- [ ] T056 [P] Update backend environment example with VPN variables in `backend/.env.example`
- [ ] T057 [P] Add VPN admin API documentation link or notes in `docs/api/endpoints.md`
- [ ] T058 [P] Review `specs/012-vpn-control-plane/contracts/vpn-admin-api.yaml` against implemented response field names
- [ ] T059 Run full backend formatting and tests for VPN changes in `backend/`
- [ ] T060 Run quickstart validation steps and record any deviations in `specs/012-vpn-control-plane/quickstart.md`
- [ ] T061 Search for accidental private key exposure strings in VPN tests/log fixtures under `backend/internal/`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup and blocks all user stories.
- **User Stories 1-3 (P1)**: Depend on Foundational. US2 depends on US1 network bootstrap. US3 depends on US2 key generation for generated-key peers.
- **User Stories 4-5 (P2)**: Depend on peer lifecycle from US3. US5 can run in parallel with US4 after US3 if different files are coordinated.
- **Polish (Phase 8)**: Depends on all selected user stories.

### User Story Dependencies

- **US1 Configure Default VPN Network**: First MVP slice after Foundation.
- **US2 Initialize And Protect Server Keys**: Depends on US1 default network persistence.
- **US3 Create And Manage VPN Peers**: Depends on US1 network state and US2 key utilities.
- **US4 Generate Peer Connection Material**: Depends on US3 peer records and US2 keys.
- **US5 Read Control-Plane Runtime Status**: Depends on US3 peer records.

### Within Each User Story

- Tests are written before implementation.
- Domain/service rules before handlers.
- Repository methods before handlers that persist state.
- Routes after handlers.
- Story checkpoint validation before moving to the next story.

---

## Parallel Opportunities

- T002-T006 can run in parallel after T001.
- T008 and T014 can run in parallel with config work T007 after file ownership is clear.
- US1 tests T018-T020 can run in parallel.
- US2 tests T026-T028 can run in parallel.
- US3 tests T034-T036 can run in parallel.
- US4 tests T044-T045 can run in parallel.
- US5 tests T051-T052 can run in parallel.
- Polish docs/contracts T056-T058 can run in parallel after implementation stabilizes.

---

## Parallel Example: User Story 3

```bash
# Independent test work for peer lifecycle:
Task: "T034 [P] [US3] Add peer IP allocation, duplicate, and pool exhaustion tests in backend/internal/vpn/ipam_test.go"
Task: "T035 [P] [US3] Add peer lifecycle repository tests for create/list/get/update/delete in backend/internal/repository/vpn_store_test.go"
Task: "T036 [P] [US3] Add peer admin API tests for create/list/get/patch/delete and non-admin rejection in backend/internal/api/handler/vpn_test.go"
```

---

## Implementation Strategy

### MVP First

1. Complete Phase 1 and Phase 2.
2. Complete US1, US2, and US3 in order.
3. Validate admins can view network status, server public key is safe, and peers can be created/listed/updated/deleted.
4. Stop and demo the control-plane lifecycle before config generation polish.

### Incremental Delivery

1. US1 establishes visible default network state.
2. US2 adds protected server key material.
3. US3 adds peer lifecycle and IP assignment.
4. US4 adds generated connection material.
5. US5 completes stable runtime placeholder status.

### Validation Commands

```bash
cd backend && go test ./...
```

Run quickstart API calls from `specs/012-vpn-control-plane/quickstart.md` after the backend is running.

---

## Notes

- Every VPN admin route must remain behind JWT auth and `AdminOnly`.
- Server private key plaintext must never appear in API responses, logs, or fixtures.
- Do not add wgctrl-go, wireguard-go runtime startup, TUN creation, route changes, DNS changes, NAT, or agent installation tasks in this phase.
- Keep `contracts/vpn-admin-api.yaml`, `quickstart.md`, and implemented response field names synchronized.
