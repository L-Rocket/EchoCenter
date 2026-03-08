#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"

BASE_URL="${STRESS_BASE_URL:-http://localhost:8080}"
AUTOSTART="${STRESS_AUTOSTART:-1}"
KEEP_SERVER="${STRESS_KEEP_SERVER:-0}"
STRESS_DB_PATH="${STRESS_DB_PATH:-$BACKEND_DIR/data/stress_llm.db}"
DB_DRIVER_OVERRIDE="${DB_DRIVER:-}"
DB_DSN_OVERRIDE="${DB_DSN:-}"
LOG_DIR="$BACKEND_DIR/logs"
LOG_FILE="$LOG_DIR/stress-llm-backend.log"
RESULT_FILE="$LOG_DIR/stress-llm-result-$(date +%Y%m%d-%H%M%S).log"

if [ -f "$BACKEND_DIR/.env" ]; then
  set -a
  # shellcheck source=/dev/null
  . "$BACKEND_DIR/.env"
  set +a
fi

export STRESS_ADMIN_USER="${STRESS_ADMIN_USER:-${INITIAL_ADMIN_USER:-admin}}"
export STRESS_ADMIN_PASS="${STRESS_ADMIN_PASS:-${INITIAL_ADMIN_PASS:-admin123}}"

SERVER_PID=""
STARTED_SERVER="0"

mkdir -p "$LOG_DIR"

cleanup() {
  if [ "$KEEP_SERVER" = "1" ]; then
    return
  fi
  if [ -n "$SERVER_PID" ]; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

is_port_open() {
  curl -fsS --max-time 1 "$BASE_URL/api/ping" >/dev/null 2>&1
}

if is_port_open; then
  echo "[stress-llm] backend already running at $BASE_URL, skip autostart"
  AUTOSTART="0"
fi

if [ "$AUTOSTART" = "1" ]; then
  echo "[stress-llm] building backend server..."
  cd "$BACKEND_DIR"
  go build -o bin/server ./cmd/server

  START_DB_DRIVER="sqlite"
  if [ -n "$DB_DRIVER_OVERRIDE" ]; then
    START_DB_DRIVER="$DB_DRIVER_OVERRIDE"
  fi
  START_DSN="${DB_DSN_OVERRIDE:-}"

  echo "[stress-llm] starting backend with MOCK_MODE=true (log: $LOG_FILE)"
  echo "[stress-llm] db driver: $START_DB_DRIVER"
  if [ "$START_DB_DRIVER" = "sqlite" ]; then
    DB_DRIVER=sqlite DB_PATH="$STRESS_DB_PATH" MOCK_MODE=true APP_ENV=development ./bin/server >"$LOG_FILE" 2>&1 &
  else
    DB_DRIVER="$START_DB_DRIVER" DB_DSN="$START_DSN" MOCK_MODE=true APP_ENV=development ./bin/server >"$LOG_FILE" 2>&1 &
  fi
  SERVER_PID=$!
  STARTED_SERVER="1"

  echo -n "[stress-llm] waiting for /api/ping"
  for _ in $(seq 1 60); do
    if is_port_open; then
      echo " ok"
      break
    fi
    echo -n "."
    sleep 1
  done
  if ! is_port_open; then
    echo
    echo "[stress-llm] backend did not become ready in time"
    exit 1
  fi
fi

echo "[stress-llm] running stress client..."
cd "$BACKEND_DIR"
go run ./cmd/stressllm | tee "$RESULT_FILE"

if [ "$STARTED_SERVER" = "1" ] && [ "$KEEP_SERVER" = "0" ]; then
  echo "[stress-llm] stopping backend"
fi

echo "[stress-llm] done"
echo "[stress-llm] result file: $RESULT_FILE"
