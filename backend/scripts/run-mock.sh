#!/bin/bash

# EchoCenter unified mock bootstrap (API-only)
# Startup order: backend -> login -> optional reset -> seed -> Python agent -> frontend

set -e

echo "=========================================="
echo "  EchoCenter Mock Bootstrap"
echo "=========================================="

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_DIR="$(dirname "$BACKEND_DIR")"
FRONTEND_DIR="$PROJECT_DIR/frontend"
LOG_DIR="$BACKEND_DIR/logs"
BACKEND_LOG_FILE="$LOG_DIR/run-mock-backend.log"
OPENHANDS_LOG_FILE="$LOG_DIR/run-mock-openhands.log"
DB_DRIVER_OVERRIDE="${DB_DRIVER_OVERRIDE:-${DB_DRIVER:-}}"

if [ -f "$BACKEND_DIR/.env" ]; then
    set -a
    # shellcheck source=/dev/null
    . "$BACKEND_DIR/.env"
    set +a
fi

API_URL="${API_URL:-http://localhost:8080/api}"
ADMIN_USER="${ADMIN_USER:-${INITIAL_ADMIN_USER:-admin}}"
ADMIN_PASS="${ADMIN_PASS:-${INITIAL_ADMIN_PASS:-admin123}}"
DB_DRIVER="$(echo "${DB_DRIVER:-sqlite}" | tr '[:upper:]' '[:lower:]')"
if [ -n "$DB_DRIVER_OVERRIDE" ]; then
    DB_DRIVER="$(echo "$DB_DRIVER_OVERRIDE" | tr '[:upper:]' '[:lower:]')"
fi
RESET="${RESET:-1}"
OPENHANDS_ENABLED_RAW="${OPENHANDS_ENABLED:-}"
if [ -z "$OPENHANDS_ENABLED_RAW" ]; then
    OPENHANDS_ENABLED="true"
else
    OPENHANDS_ENABLED="$(echo "$OPENHANDS_ENABLED_RAW" | tr '[:upper:]' '[:lower:]')"
fi
OPENHANDS_SERVICE_URL="${OPENHANDS_SERVICE_URL:-}"
OPENHANDS_PYTHON_BIN="${OPENHANDS_PYTHON_BIN:-python3}"
OPENHANDS_WORKER_PID=""

if [ "$OPENHANDS_ENABLED" = "true" ] && [ -z "$OPENHANDS_SERVICE_URL" ]; then
    OPENHANDS_SERVICE_URL="http://127.0.0.1:8000"
fi

should_start_openhands_worker() {
    if [ "$OPENHANDS_ENABLED" != "true" ]; then
        return 1
    fi
    if [ -z "$OPENHANDS_SERVICE_URL" ]; then
        return 0
    fi
    case "$OPENHANDS_SERVICE_URL" in
        http://127.0.0.1:*|http://localhost:*)
            return 0
            ;;
        *)
            return 1
            ;;
    esac
}

if [ "$DB_DRIVER" = "postgresql" ]; then
    DB_DRIVER="postgres"
fi
if [ "$DB_DRIVER" != "sqlite" ] && [ "$DB_DRIVER" != "postgres" ]; then
    echo -e "${RED}Error: unsupported DB_DRIVER '$DB_DRIVER'. Use a supported driver value.${NC}"
    exit 1
fi

echo "Project directory: $PROJECT_DIR"
echo "Database driver: $DB_DRIVER"
echo "RESET mode: $RESET"
echo "Backend log file: $BACKEND_LOG_FILE"
if should_start_openhands_worker; then
    echo "OpenHands worker: local ($OPENHANDS_SERVICE_URL)"
else
    echo "OpenHands worker: external/disabled"
fi

export GOCACHE="${GOCACHE:-$BACKEND_DIR/.cache/go-build}"
mkdir -p "$GOCACHE"
mkdir -p "$LOG_DIR"

echo -e "${YELLOW}[1/5] Cleaning environment...${NC}"
lsof -ti:8080 | xargs kill -9 2>/dev/null || true
lsof -ti:5173 | xargs kill -9 2>/dev/null || true
sleep 1

if [ "$DB_DRIVER" = "postgres" ]; then
    DB_ACTION="ensure"
    if [ "$RESET" = "1" ]; then
        DB_ACTION="recreate"
    fi

    echo "  Preparing postgres database (${DB_ACTION})..."
    if ! (cd "$BACKEND_DIR" && go run ./cmd/mockdb --action "$DB_ACTION"); then
        echo -e "${RED}Error: failed to prepare postgres database.${NC}"
        exit 1
    fi
fi

echo -e "${YELLOW}[2/5] Starting backend service...${NC}"
cd "$BACKEND_DIR"
go build -o bin/server ./cmd/server
echo "[$(date '+%Y-%m-%d %H:%M:%S')] run-mock start" >> "$BACKEND_LOG_FILE"
# Keep backend logs visible in terminal while persisting the same stream to file.
./bin/server > >(tee -a "$BACKEND_LOG_FILE") 2>&1 &
BACKEND_PID=$!
echo -e "${GREEN}  Backend started (PID: $BACKEND_PID, log: $BACKEND_LOG_FILE)${NC}"

if should_start_openhands_worker; then
    echo "  Starting local OpenHands worker..."
    lsof -ti:8000 | xargs kill -9 2>/dev/null || true
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] run-mock openhands start" >> "$OPENHANDS_LOG_FILE"
    "$OPENHANDS_PYTHON_BIN" -m uvicorn app:app \
        --app-dir "$PROJECT_DIR/third_party/openhands" \
        --host 127.0.0.1 \
        --port 8000 \
        > >(tee -a "$OPENHANDS_LOG_FILE") 2>&1 &
    OPENHANDS_WORKER_PID=$!
    echo -e "${GREEN}  OpenHands worker started (PID: $OPENHANDS_WORKER_PID, log: $OPENHANDS_LOG_FILE)${NC}"
    echo "  Waiting OpenHands health check..."
    for _ in $(seq 1 20); do
        if curl -fsS "${OPENHANDS_SERVICE_URL%/}/healthz" >/dev/null 2>&1; then
            echo -e "${GREEN}  OpenHands worker is healthy${NC}"
            break
        fi
        sleep 0.5
    done
fi

echo "  Waiting backend initialization..."
sleep 5

echo "  Logging in as admin..."
LOGIN_RES=$(curl -s -X POST "$API_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"$ADMIN_USER\",\"password\":\"$ADMIN_PASS\"}")
TOKEN=$(echo "$LOGIN_RES" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
if [ -z "$TOKEN" ]; then
    echo -e "${RED}Error: admin login failed. Response: $LOGIN_RES${NC}"
    exit 1
fi

if [ "$RESET" = "1" ]; then
    echo "  Calling dev mock reset API..."
    RESET_RES=$(curl -s -X POST "$API_URL/dev/mock/reset" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $TOKEN")
    if ! echo "$RESET_RES" | grep -q '"status":"reset"'; then
        echo -e "${RED}Error: mock reset failed. Response: $RESET_RES${NC}"
        exit 1
    fi
else
    echo "  Skip DB reset (RESET=$RESET)"
fi

echo -e "${YELLOW}[3/5] Seeding mock data...${NC}"
cd "$SCRIPT_DIR"
API_URL="$API_URL" ADMIN_USER="$ADMIN_USER" ADMIN_PASS="$ADMIN_PASS" ./seed_mock_data.sh
cd "$BACKEND_DIR"

echo -e "${YELLOW}[4/5] Starting Storage-Custodian agent...${NC}"
TOKEN_RES=$(curl -s -X GET "$API_URL/dev/mock/agent-token/Storage-Custodian" \
    -H "Authorization: Bearer $TOKEN")
AGENT_TOKEN=$(echo "$TOKEN_RES" | grep -o '"api_token":"[^"]*' | cut -d'"' -f4)
AGENT_PID=""
if [ -z "$AGENT_TOKEN" ]; then
    echo -e "${RED}  Warning: Storage-Custodian token not found, skip agent startup.${NC}"
else
    STORAGE_CUSTODIAN_TOKEN="$AGENT_TOKEN" python3 "$BACKEND_DIR/mock_agents/storage_custodian.py" &
    AGENT_PID=$!
    echo -e "${GREEN}  Storage-Custodian started (PID: $AGENT_PID)${NC}"
fi

sleep 2

echo -e "${YELLOW}[5/5] Starting frontend...${NC}"
cd "$FRONTEND_DIR"
npm run dev &
FRONTEND_PID=$!
echo -e "${GREEN}  Frontend started (PID: $FRONTEND_PID)${NC}"

cd "$PROJECT_DIR"

echo ""
echo "=========================================="
echo -e "${GREEN}  All services started!${NC}"
echo "=========================================="
echo "  Frontend: http://localhost:5173"
echo "  Backend:  http://localhost:8080"
echo "  Username: $ADMIN_USER"
echo "  Password: $ADMIN_PASS"
echo ""
echo "  Press Ctrl+C to stop all services"
echo "=========================================="

cleanup() {
    echo ""
    echo -e "${YELLOW}Stopping all services...${NC}"
    kill "$FRONTEND_PID" 2>/dev/null || true
    if [ -n "$AGENT_PID" ]; then
        kill "$AGENT_PID" 2>/dev/null || true
    fi
    if [ -n "$OPENHANDS_WORKER_PID" ]; then
        kill "$OPENHANDS_WORKER_PID" 2>/dev/null || true
    fi
    kill "$BACKEND_PID" 2>/dev/null || true
    echo -e "${GREEN}All services stopped${NC}"
    exit 0
}

trap cleanup INT TERM

wait
