# Implementation Plan: VPN Control Plane MVP

**Branch**: `012-vpn-control-plane` | **Date**: 2026-04-23 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/012-vpn-control-plane/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Build the first-phase VPN control plane for EchoCenter: a backend-admin-only
surface that manages one default virtual network, initializes protected
WireGuard-compatible server key material, creates and manages peers, assigns
virtual IPs, generates peer connection material, and exposes stable status
fields for a later runtime integration. This phase deliberately does not create
network devices, start a VPN runtime, alter routes/DNS, install agent software,
or guarantee peer online state.

The implementation approach is a backend-focused extension using existing
configuration, repository, Gin routing, auth middleware, and migration patterns.
It adds durable `vpn_networks` and `vpn_peers` records, reusable secret
encryption helpers for private key material, a small VPN domain service for
validation/IP allocation/config generation, admin routes under `/api/vpn`, API
contract documentation, and quickstart validation steps.

## Technical Context

**Language/Version**: Go 1.25.5 module in `backend/go.mod`; repository README still advertises Go 1.22+, so implementation should avoid newer language features unless the project baseline is intentionally updated.  
**Primary Dependencies**: Existing Gin routing, JWT/AdminOnly middleware, SQL repository abstraction, `golang.org/x/crypto` for X25519-compatible key generation, standard library IP/CIDR validation, existing app error helpers. No wgctrl-go/runtime dependency in Phase 1.  
**Storage**: Existing SQLite default and PostgreSQL support through repository migrations. Add `vpn_networks` and `vpn_peers` with `network_id` even though only one default network is managed in Phase 1.  
**Testing**: Backend unit and integration tests with `go test ./...`; repository tests for SQLite/PostgreSQL-compatible behavior; handler tests for auth, validation, secret redaction, peer lifecycle, and config generation. Manual quickstart verifies the admin API workflow.  
**Target Platform**: EchoCenter backend admin API and local/Docker deployments. No host network device, route, DNS, NAT, or WireGuard runtime manipulation.  
**Project Type**: Backend service feature with externally visible admin HTTP contracts and generated WireGuard client material.  
**Performance Goals**: Admin status and list operations complete within 10 seconds; peer creation plus config generation completes within 2 minutes; IP allocation remains deterministic and unique for the default `/16` example network.  
**Constraints**: Admin-only access, no raw server private key exposure, protected private key storage, fail-fast validation, stable runtime-placeholder semantics, token-safe logs/audit events, no unbounded background workers.  
**Scale/Scope**: One default VPN network, many managed peers within the configured CIDR, status model prepared for future live handshake/rx/tx updates.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Agent Contracts**: PASS. The plan documents stable admin API paths, generated
  WireGuard config shape, Agent WebSocket guidance, disabled/deleted peer
  semantics, and unknown runtime status semantics in `contracts/vpn-admin-api.yaml`.
- **Secure Boundaries**: PASS. All routes stay behind existing JWT auth plus
  `AdminOnly`; server private key never leaves storage; peer private key is
  returned only for server-generated peers; logs/audit events must exclude
  private key material.
- **Real-Time Reliability**: PASS. This phase does not change live WebSocket
  routing, but generated guidance uses the existing Agent WebSocket path and
  clearly distinguishes configured control-plane state from unavailable runtime
  data.
- **Observability & Fail-Fast**: PASS. Invalid config, malformed keys, duplicate
  keys/IPs, exhausted pools, deleted peers, and unauthorized access fail before
  state changes. Admin create/update/delete/config actions require logs or audit
  events without secrets.
- **Pragmatic Verification**: PASS. Scope is limited to backend control-plane
  data, contracts, and generated config. No new runtime worker, TUN device,
  DNS, route, NAT, or agent installer is introduced.

## Project Structure

### Documentation (this feature)

```text
specs/012-vpn-control-plane/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── vpn-admin-api.yaml
└── tasks.md
```

### Source Code (repository root)

```text
backend/
├── internal/
│   ├── api/
│   │   ├── handler/          # VPN admin handlers and handler tests
│   │   └── router/           # /api/vpn admin route registration
│   ├── config/               # VPN env config and validation
│   ├── models/               # VPNNetwork, VPNPeer, request/response DTOs
│   ├── repository/           # migrations, repository interface, vpn store tests
│   └── vpn/                  # domain service: keys, IP allocation, config rendering
├── pkg/
│   └── errors/               # existing app error taxonomy reused
└── data/                     # local SQLite data; no committed runtime data

docs/
└── development/              # optional follow-up docs if API/user setup docs need promotion
```

**Structure Decision**: Implement the MVP inside the backend because Phase 1 has
no UI editor and exposes admin API/contracts only. Add a small `backend/internal/vpn`
domain package to keep validation, key generation, IP allocation, and config
rendering out of HTTP handlers and SQL code. Extend `repository.Repository`
rather than creating a parallel persistence layer, because EchoCenter already
centralizes data access there.

## Complexity Tracking

No Constitution Check violations.
