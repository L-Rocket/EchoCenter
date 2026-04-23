# Quickstart: VPN Control Plane MVP

This quickstart validates Phase 1 control-plane behavior without starting
WireGuard, creating a network interface, changing routes, or editing system DNS.

## 1. Configure Backend Environment

Add VPN settings to `backend/.env` or the environment used to start the backend:

```bash
VPN_ENABLED=true
VPN_NAME="EchoCenter VPN"
VPN_INTERFACE_NAME=wg-echo
VPN_NETWORK_CIDR=10.88.0.0/16
VPN_SERVER_IP=10.88.0.1
VPN_LISTEN_PORT=51820
VPN_DOMAIN=echocenter.vpn
VPN_PUBLIC_HOST=echocenter.example.com
VPN_KEY_ENCRYPTION_SECRET="replace-with-a-strong-secret"
JWT_SECRET="at-least-32-characters-and-still-required"
```

If `VPN_KEY_ENCRYPTION_SECRET` is not supplied, the implementation may fall
back to the existing app secret policy, but production deployments should use a
dedicated secret.

## 2. Start EchoCenter

```bash
make run-mock RESET=1
```

The backend should initialize one default VPN network and generate server key
material if none exists.

## 3. Log In As Admin

```bash
curl -s http://localhost:8080/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin123"}'
```

Store the returned JWT as `TOKEN`.

## 4. Check VPN Status

```bash
curl -s http://localhost:8080/api/vpn/status \
  -H "Authorization: Bearer $TOKEN"
```

Expected:

- `enabled` reflects `VPN_ENABLED`.
- Network fields match the configured defaults.
- `server_public_key` is present.
- No server private key appears anywhere in the response.
- Runtime-only peer fields are absent, null, or marked with `source: "unknown"`.

## 5. Create A Server-Generated Peer

```bash
curl -s http://localhost:8080/api/vpn/peers \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"name":"agent-alpha"}'
```

Expected:

- Peer is created with a unique `virtual_ip`, such as `10.88.1.10`.
- `allowed_ips` defaults to `10.88.0.1/32`.
- `persistent_keepalive` defaults to `25`.
- `private_key_available` is `true`.

## 6. Download Full Peer Config

```bash
curl -s http://localhost:8080/api/vpn/peers/1/config \
  -H "Authorization: Bearer $TOKEN"
```

Expected:

- `mode` is `full_client_config`.
- `wireguard_config` contains `[Interface]` and `[Peer]`.
- `wireguard_config` contains the peer private key but never the server private
  key.
- `agent_websocket_url` is `ws://echocenter.vpn:8080/api/ws`.
- `hosts_entry` is `10.88.0.1 echocenter.vpn`.

## 7. Create An External-Key Peer

```bash
curl -s http://localhost:8080/api/vpn/peers \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"name":"agent-bravo","public_key":"<valid-peer-public-key>"}'
```

Expected:

- Peer is created with `private_key_available: false`.
- Config generation returns a server fragment or guidance that the peer owner
  must provide the private key.

## 8. Validate Admin-Only Access

Call any VPN endpoint without `Authorization` and with a non-admin token.

Expected:

- Missing/invalid JWT returns `401`.
- Non-admin JWT returns `403`.
- No state changes occur.

## 9. Validate Phase 1 Non-Goals

Confirm the feature does not:

- start WireGuard or wireguard-go,
- create a TUN device,
- change host routes,
- change host DNS,
- configure NAT or egress proxying,
- install software on agents,
- claim peer online status from generated control-plane state alone.
