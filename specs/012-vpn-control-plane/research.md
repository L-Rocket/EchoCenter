# Phase 0 Research: VPN Control Plane MVP

## Decision: Phase 1 is a backend-only control plane

**Rationale**: The specification explicitly excludes starting WireGuard,
creating TUN devices, editing routes, editing DNS, NAT/egress proxying, agent
auto-installation, and online-status guarantees. A backend-admin API can define
the durable contracts, keys, peer lifecycle, IP assignment, and generated client
material without host-level side effects.

**Alternatives considered**:

- Start with wgctrl-go or wireguard-go integration: rejected for Phase 1 because
  it would cross into runtime device management and obscure the API/data-model
  contract work.
- Build frontend UI first: rejected because the spec says configuration can
  come from environment variables and the first value is the control plane.

## Decision: Use existing EchoCenter backend patterns

**Rationale**: EchoCenter already uses Gin handlers, protected/admin route
groups, repository interfaces, app error wrappers, and SQL migrations for both
SQLite and PostgreSQL. Reusing those patterns keeps the change small and makes
auth, validation, and tests consistent with existing admin features.

**Alternatives considered**:

- Separate service/binary: rejected because there is no separate runtime in this
  phase.
- New persistence abstraction outside `repository.Repository`: rejected because
  it duplicates existing database ownership and complicates tests.

## Decision: Add `backend/internal/vpn` for domain logic

**Rationale**: VPN key generation, public-key validation, CIDR validation, IP
allocation, AllowedIPs defaults, status placeholders, and config rendering are
domain rules that should be testable without HTTP or SQL. A small internal
package keeps handlers thin and makes later wgctrl-go integration easier.

**Alternatives considered**:

- Put logic directly in handlers: rejected because it mixes validation, storage,
  and rendering, making secret-redaction tests harder.
- Put logic directly in repository: rejected because SQL code should not own
  product behavior like config shape and IP allocation policy.

## Decision: Generate WireGuard-compatible keys without runtime integration

**Rationale**: Phase 1 only needs key material and config generation. Use the
existing `golang.org/x/crypto` dependency for X25519-compatible key derivation
and base64 output, with validation against expected WireGuard key encoding.
This avoids adding wgctrl-go until runtime state is needed.

**Alternatives considered**:

- Shell out to `wg genkey`: rejected because it requires system tooling and
  violates the "no system network capability" boundary for the MVP.
- Add wgctrl-go now: deferred to Phase 2 when live interface and peer stats are
  in scope.

## Decision: Reuse and generalize AES-GCM secret storage

**Rationale**: The repository already encrypts SSH private keys with AES-GCM
using an environment-provided secret or `JWT_SECRET`. VPN server private keys
and optional generated peer private keys need the same protected handling, but
the helper should be moved or generalized so VPN code does not depend on an SSH
specific helper name.

**Alternatives considered**:

- Store private keys in plaintext: rejected by the specification and
  constitution.
- One-time peer private key only with no storage: rejected for Phase 1 because
  the spec allows complete config download for server-generated peers; the plan
  keeps storage protected and response scope explicit.

## Decision: Reserve `network_id` and one active default network

**Rationale**: The spec requires single-network behavior now with future
multi-network room. `vpn_networks` owns network metadata and server key
references; `vpn_peers.network_id` keeps the later expansion path without
renaming peer records.

**Alternatives considered**:

- Store all network settings only in config/env: rejected because server key
  state and peers need durable ownership.
- Build full multi-network behavior now: rejected as premature scope.

## Decision: Return unknown runtime metrics explicitly

**Rationale**: The MVP cannot observe last handshake or rx/tx bytes. Returning
`unknown`/`null` avoids misleading zero values and leaves the response contract
stable for Phase 2.

**Alternatives considered**:

- Omit runtime fields: rejected because the spec wants status fields defined now.
- Return zero values: rejected because zero can be misread as measured traffic or
  a real never-handshaked state.
