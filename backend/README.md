# EchoCenter Backend

EchoCenter backend provides:
- JWT authentication
- WebSocket chat/event routing
- Butler orchestration and authorization workflow
- Agent registration + token lifecycle
- Feishu long-connection (WebSocket) integration

## Runtime

```bash
# Development
go run cmd/server/main.go

# Build
go build -o bin/server ./cmd/server
./bin/server
```

## WebSocket C10K Stress Test

`cmd/stress_test` is a purpose-built WebSocket long-connection pressure tool for EchoCenter.

Typical flow:

```bash
# 1) Raise open-file limits first (important for C10K)
ulimit -n 65535

# 2) Start backend in another terminal
go run cmd/server/main.go

# 3) Run stress test (auto login mode)
go run ./cmd/stress_test \
  --ws-url ws://127.0.0.1:8080/api/ws \
  --username admin \
  --password admin123 \
  --source-ips 127.0.0.1,127.0.0.2,127.0.0.3 \
  --connections 10000 \
  --workers 300 \
  --connect-rate 1000 \
  --hold 10m \
  --ping-interval 20s \
  --stats-interval 5s
```

If you already have a token:

```bash
go run ./cmd/stress_test \
  --ws-url ws://127.0.0.1:8080/api/ws \
  --token "<JWT_OR_AGENT_TOKEN>" \
  --connections 10000
```

Observe backend memory/thread trends by passing server PID:

```bash
BACKEND_PID=$(pgrep -f "cmd/server/main.go|bin/server" | head -n1)
go run ./cmd/stress_test --backend-pid "$BACKEND_PID" ...
```

If failed dials are mostly `cannot assign requested address`, your load-generator host ran out of ephemeral source ports (client-side bottleneck, not necessarily backend limit):

```bash
# Check ephemeral port range width
cat /proc/sys/net/ipv4/ip_local_port_range

# Optional tuning on Linux load generator (requires sudo)
sudo sysctl -w net.ipv4.ip_local_port_range="1024 65535"
sudo sysctl -w net.core.somaxconn=65535
sudo sysctl -w net.ipv4.tcp_max_syn_backlog=65535
```

For strict C10K validation, run with multiple load-generator IPs/processes when a single host cannot provide enough source ports.

### Validation Record

- Date: `2026-03-08`
- Scenario: idle WebSocket long-connection capacity (no business message traffic), periodic client Ping
- Result: `20,000 / 20,000` connections established and held successfully (`100%`)
- Key runner settings:
  - `--connections 20000 --workers 600 --connect-rate 800 --connect-timeout 30s --hold 30s`
  - `--source-ips 127.0.0.1 ... 127.0.0.10`
- Observed backend process snapshot during steady hold:
  - RSS around `401MB~415MB`
  - Threads around `29`

Interpretation: under the above test profile, EchoCenter can sustain at least `20,000` concurrently connected idle Agent/WebSocket clients.

## Database

- Uses the built-in default database configuration (`DB_PATH=./data/echo_center.db`)
- Optional: PostgreSQL (`DB_DRIVER=postgres`)
  - Use `DB_DSN` directly, or split config with `PG_HOST`, `PG_PORT`, `PG_USER`, `PG_PASSWORD`, `PG_DATABASE`, `PG_SSLMODE`

## Feishu Integration (Current Mode)

- Uses Feishu long connection (`FEISHU_WS_ENABLED=true`)
- No public Feishu event callback route is required for message ingestion
- Connector verification (`/api/integrations/feishu/:id/verify-callback`) performs real credential validation against Feishu auth API
- Supports:
  - inbound message routing to Butler
  - Butler outbound reply relay to Feishu
  - Feishu interactive cards for Butler authorization approval/rejection

## Mock Bootstrap

`make run-mock` starts backend + seed + mock agent + frontend.

Key behavior:
- `RESET` default is `1` in root `Makefile`
- `RESET=1` calls `/api/dev/mock/reset` before seeding
- For PostgreSQL, `backend/cmd/mockdb` recreates the target DB when `RESET=1`

Examples:

```bash
make run-mock RESET=1
DB_DRIVER=postgres make run-mock RESET=1
make run-mock RESET=0
```

Deprecated aliases:
- `make run-mock-sqllite`
- `make run-mock-postgre`
