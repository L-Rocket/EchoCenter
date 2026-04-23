# Feature Specification: VPN Control Plane MVP

**Feature Branch**: `012-vpn-control-plane`  
**Created**: 2026-04-23  
**Status**: Draft  
**Input**: User description: "第一阶段建议定义为：VPN 控制平面 MVP。目标不是立刻打通所有系统网络能力，而是先让 EchoCenter 能安全、清晰地管理一张虚拟局域网。"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Configure Default VPN Network (Priority: P1)

An administrator enables and reviews a single default VPN network for EchoCenter,
including its display name, interface name, network CIDR, EchoCenter VPN address,
listen port, VPN domain, and enabled/disabled state.

**Why this priority**: The control plane needs a clear network identity before
keys, peers, and generated client configuration can be trusted.

**Independent Test**: Start EchoCenter with VPN feature settings present and
confirm an administrator can retrieve a complete VPN status view that reflects
the configured default network without requiring any host network changes.

**Acceptance Scenarios**:

1. **Given** VPN settings are configured and enabled, **When** an administrator
   opens the VPN status, **Then** they see the network name, interface name,
   VPN CIDR, EchoCenter VPN IP, listen port, VPN domain, server public key if
   initialized, peer count, and enabled state.
2. **Given** VPN settings are configured but disabled, **When** an administrator
   opens the VPN status, **Then** they see the configured network metadata and a
   disabled state, and peer management actions do not imply the VPN is online.
3. **Given** no DNS service is provided by EchoCenter in this phase, **When** an
   administrator views connection guidance, **Then** the guidance includes the
   hostname mapping `10.88.0.1 echocenter.vpn`.

---

### User Story 2 - Initialize And Protect Server Keys (Priority: P1)

An administrator relies on EchoCenter to create and preserve the VPN server key
pair while only exposing the server public key through administrative views.

**Why this priority**: Peer configuration cannot be generated safely unless
EchoCenter has a stable server public key and protects the private key from API
or log disclosure.

**Independent Test**: Initialize VPN control-plane state and confirm the server
public key is available while the server private key never appears in API
responses, generated logs, status views, peer lists, or peer configuration
downloads.

**Acceptance Scenarios**:

1. **Given** no server key pair exists, **When** the VPN control plane is first
   initialized, **Then** EchoCenter creates a server key pair and stores the
   private key in protected storage.
2. **Given** a server key pair exists, **When** an administrator retrieves VPN
   status, **Then** the response includes the server public key and excludes the
   server private key.
3. **Given** a server private key exists, **When** any peer, status, or config
   endpoint is called, **Then** the server private key is never returned in
   plaintext.

---

### User Story 3 - Create And Manage VPN Peers (Priority: P1)

An administrator creates VPN peers for agents or nodes, optionally binds them to
an Agent or User, assigns a virtual IP, and enables, disables, views, or deletes
those peers.

**Why this priority**: Peer lifecycle management is the main administrative
workflow that turns the network definition into usable agent connectivity.

**Independent Test**: Create peers in both supported modes, verify each peer
receives a unique virtual IP and safe defaults, then disable and delete a peer
without affecting other peers.

**Acceptance Scenarios**:

1. **Given** an administrator provides a peer name and asks EchoCenter to
   generate credentials, **When** the peer is created, **Then** the peer receives
   a key pair, a unique virtual IP such as `10.88.1.10/32`, default AllowedIPs
   of `10.88.0.1/32`, PersistentKeepalive of `25`, and an enabled state.
2. **Given** an administrator provides a peer name and an existing peer public
   key, **When** the peer is created, **Then** EchoCenter stores only the supplied
   public key, assigns the same safe defaults, and does not claim to know the
   peer private key.
3. **Given** a peer exists, **When** an administrator disables it, **Then** the
   peer remains listed with its assigned virtual IP and disabled state, and newly
   generated guidance marks it as not currently enabled.
4. **Given** a peer exists, **When** an administrator deletes it, **Then** the
   peer no longer appears in the active peer list and its generated config is no
   longer available.

---

### User Story 4 - Generate Peer Connection Material (Priority: P2)

An administrator downloads or views connection material for a peer so an agent or
node operator can connect to EchoCenter through the VPN address and domain.

**Why this priority**: The control plane is valuable when it produces clear,
copy-ready setup information for each peer, even before EchoCenter manages the
host network device directly.

**Independent Test**: Generate connection material for a server-generated peer
and for an external-key peer, then confirm the material contains the expected
address, DNS, endpoint, allowed IPs, keepalive, Agent WebSocket URL, and hosts
mapping guidance with no server private key exposure.

**Acceptance Scenarios**:

1. **Given** a peer was created with server-generated credentials, **When** an
   administrator requests its config, **Then** EchoCenter returns a complete
   client WireGuard configuration containing the peer private key, peer address,
   DNS value, EchoCenter public key, endpoint, AllowedIPs, and keepalive.
2. **Given** a peer was created from an existing public key, **When** an
   administrator requests its config, **Then** EchoCenter returns a peer
   configuration fragment and clear guidance that the peer private key must be
   supplied by the peer owner.
3. **Given** a peer config is generated, **When** an administrator reviews the
   connection guidance, **Then** it includes the Agent WebSocket address
   `ws://echocenter.vpn:8080/api/ws` and the hosts mapping
   `10.88.0.1 echocenter.vpn`.

---

### User Story 5 - Read Control-Plane Runtime Status (Priority: P2)

An administrator inspects VPN and peer status fields that are stable enough for
the first phase and extensible enough for a later real runtime integration.

**Why this priority**: Operators need a predictable status model now, while real
handshake and traffic counters can be populated in a later phase.

**Independent Test**: Retrieve VPN status and peer details and confirm they
include enabled state, interface name, server public key, listen port, network
CIDR, peer count, peer virtual IP, peer enabled state, last handshake, and rx/tx
bytes, with unavailable runtime values represented as unknown or empty.

**Acceptance Scenarios**:

1. **Given** the first-phase control plane has no live VPN runtime, **When** an
   administrator views peer status, **Then** last handshake and rx/tx byte values
   are shown as unknown or empty rather than invented.
2. **Given** peers exist with assigned virtual IPs, **When** an administrator
   lists peers, **Then** each peer includes its name, binding metadata when
   present, public key, virtual IP, enabled state, last handshake, and rx/tx byte
   fields.

### Edge Cases

- VPN feature is disabled while existing peers remain stored.
- VPN CIDR or EchoCenter VPN IP is missing, malformed, or outside the expected
  network.
- Listen port is missing, non-numeric, or outside the valid port range.
- VPN domain is empty or malformed.
- Peer public key is missing, malformed, duplicated, or belongs to an existing
  peer.
- Peer name is empty, duplicated, too long, or contains unsupported characters.
- Virtual IP pool is exhausted or the next candidate IP conflicts with an
  existing peer.
- A peer is created for an Agent/User ID that no longer exists or is optional.
- A generated peer private key is requested after the one-time downloadable
  material is no longer available.
- A deleted or disabled peer config is requested.
- WebSocket connection guidance is requested before VPN is enabled.
- An unauthorized or non-admin caller attempts to access any VPN endpoint.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST support one default VPN network with network name,
  interface name, network CIDR, EchoCenter VPN IP, listen port, VPN domain, and
  enabled/disabled state.
- **FR-002**: System MUST allow the default VPN network configuration to be
  supplied without requiring a user-interface editor in this phase.
- **FR-003**: System MUST generate a server private/public key pair when the VPN
  control plane is initialized without existing server keys.
- **FR-004**: System MUST store the server private key in protected form and
  MUST NOT return it in plaintext through any API, status view, peer list, peer
  detail, generated config, log, or error message.
- **FR-005**: System MUST expose the server public key to administrators.
- **FR-006**: System MUST allow administrators to list, create, view, update,
  disable, enable, and delete VPN peers.
- **FR-007**: System MUST support peer records with peer name, optional Agent ID,
  optional User ID, peer public key, virtual IP, AllowedIPs, PersistentKeepalive,
  enabled/disabled state, last handshake, rx bytes, and tx bytes.
- **FR-008**: System MUST support peer creation where EchoCenter generates the
  peer key pair and provides a complete client configuration.
- **FR-009**: System MUST support peer creation where the administrator submits
  an existing peer public key and EchoCenter provides only the server-side peer
  configuration and connection guidance.
- **FR-010**: System MUST automatically assign each peer a unique virtual IP
  within the configured VPN CIDR, expressed as a single-host address such as
  `10.88.1.10/32`.
- **FR-011**: System MUST default peer AllowedIPs to the EchoCenter VPN address
  as a single-host route, such as `10.88.0.1/32`.
- **FR-012**: System MUST default peer PersistentKeepalive to `25`.
- **FR-013**: System MUST generate client WireGuard configuration using the
  configured peer address, DNS value, EchoCenter public key, public endpoint,
  AllowedIPs, and PersistentKeepalive.
- **FR-014**: System MUST generate Agent connection guidance using the VPN
  domain, including `ws://echocenter.vpn:8080/api/ws` when the configured domain
  is `echocenter.vpn`.
- **FR-015**: System MUST include hosts-file guidance mapping the EchoCenter VPN
  IP to the VPN domain because DNS service is not provided in this phase.
- **FR-016**: System MUST expose VPN status fields for feature enabled state,
  interface name, server public key, listen port, network CIDR, peer count, peer
  virtual IPs, peer enabled states, last handshake, rx bytes, and tx bytes.
- **FR-017**: System MUST represent runtime-only status fields as unknown or
  empty when real runtime data is unavailable in this phase.
- **FR-018**: System MUST reject unauthorized and non-admin access to all VPN
  management and config endpoints.
- **FR-019**: System MUST validate VPN network settings and peer input before
  storing changes or generating configuration.
- **FR-020**: System MUST preserve data model room for future multiple VPN
  networks even though this phase manages only one default network.
- **FR-021**: System MUST clearly state that this phase does not start VPN
  runtime processes, create network devices, change host routing, change host
  DNS, provide NAT/egress proxying, auto-install VPN software on agents, or
  guarantee peer online status.

### Contract & Reliability Requirements *(include when feature touches agents, Butler, WebSocket, Feishu, APIs, or persistence)*

- **CR-001**: Admin contract MUST include the following management operations:
  retrieve VPN status, list peers, create peer, retrieve peer detail, update
  peer enabled/profile fields, delete peer, and retrieve peer config.
- **CR-002**: Admin HTTP routes SHOULD use these stable paths:
  `GET /api/vpn/status`, `GET /api/vpn/peers`, `POST /api/vpn/peers`,
  `GET /api/vpn/peers/:id`, `PATCH /api/vpn/peers/:id`,
  `DELETE /api/vpn/peers/:id`, and `GET /api/vpn/peers/:id/config`.
- **CR-003**: Generated WireGuard client configuration for server-generated
  peers MUST match this shape:

  ```ini
  [Interface]
  PrivateKey = <peer-private-key>
  Address = <peer-virtual-ip>/32
  DNS = <echocenter-vpn-ip>

  [Peer]
  PublicKey = <echocenter-public-key>
  Endpoint = <public-host>:<listen-port>
  AllowedIPs = <echocenter-vpn-ip>/32
  PersistentKeepalive = 25
  ```

- **CR-004**: Generated material MUST include the Agent WebSocket address using
  the VPN domain and the current EchoCenter WebSocket path.
- **CR-005**: Deleting or disabling a peer MUST NOT reassign its virtual IP to
  another peer during the same administrative session unless the reuse behavior
  is explicitly documented to the administrator.
- **CR-006**: Runtime status fields that are not backed by live VPN data MUST be
  returned as unknown or empty values, not as zero values that imply measured
  traffic or handshake state.

### Security & Observability Requirements *(mandatory for backend, integration, agent, admin, and command-execution changes)*

- **SO-001**: Every VPN management operation MUST require administrator
  authorization.
- **SO-002**: Server private key plaintext MUST be excluded from responses,
  logs, error messages, frontend-visible state, and exported configuration.
- **SO-003**: Peer private key plaintext MAY appear only in the generated client
  configuration for peers whose key pair was generated for that peer by
  EchoCenter.
- **SO-004**: Invalid network settings, malformed public keys, duplicate public
  keys, conflicting virtual IPs, and unauthorized requests MUST fail before any
  partial state change is committed.
- **SO-005**: Administrative create, update, delete, disable, enable, and config
  generation actions MUST be observable through operator-facing logs or audit
  events that identify the action and target peer without exposing private key
  material.

### Key Entities *(include if feature involves data)*

- **VPN Network**: The default virtual network managed by EchoCenter. Key
  attributes include network ID, name, interface name, network CIDR, EchoCenter
  VPN IP, listen port, VPN domain, enabled state, server public key reference,
  protected server private key reference, created time, and updated time.
- **VPN Peer**: A managed node or agent entry allowed to connect to the VPN. Key
  attributes include peer ID, network ID, peer name, optional Agent ID, optional
  User ID, peer public key, optional protected peer private key reference for
  server-generated peers, virtual IP, AllowedIPs, PersistentKeepalive, enabled
  state, last handshake, rx bytes, tx bytes, created time, and updated time.
- **Peer Configuration**: Generated connection material for a VPN peer. It
  includes either a complete client configuration for server-generated keys or a
  server-side fragment and setup guidance for externally generated keys.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An administrator can retrieve a complete default VPN status view
  with all required network and peer summary fields in under 10 seconds.
- **SC-002**: An administrator can create a peer and obtain connection material
  in under 2 minutes using either supported peer creation mode.
- **SC-003**: 100% of generated peer configurations include a unique virtual IP,
  EchoCenter public key, endpoint, AllowedIPs, keepalive value, Agent WebSocket
  address, and hosts mapping guidance.
- **SC-004**: 0 administrative responses expose the server private key in
  plaintext across status, peer list, peer detail, and peer config workflows.
- **SC-005**: Invalid peer public keys, duplicate peer public keys, invalid VPN
  network settings, and non-admin requests are rejected with clear failure
  messages before state changes occur.
- **SC-006**: Operators can distinguish configured control-plane data from
  unavailable live-runtime status fields for every peer.

## Assumptions

- The first phase manages exactly one default VPN network while preserving a
  network identifier in peer records for future multi-network support.
- Default example values are acceptable unless overridden by deployment
  configuration: network name `EchoCenter VPN`, interface `wg-echo`, VPN CIDR
  `10.88.0.0/16`, EchoCenter VPN IP `10.88.0.1`, listen port `51820`, and domain
  `echocenter.vpn`.
- All VPN management capabilities are administrator-only.
- DNS service is outside this phase; hosts-file guidance is the expected
  operator workflow.
- Live handshake and traffic counters are outside this phase and may be unknown
  or empty until a later runtime integration supplies real data.
- The control plane may store generated peer private keys only when needed to
  provide complete client configuration material, and any such storage must use
  protected handling equivalent to server key handling.
