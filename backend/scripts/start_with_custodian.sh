#!/bin/bash

# EchoCenter Full Stack Launcher (with Storage-Custodian Agent)
# This script starts the backend, seeds data, and launches the Python mock agent.

echo "--- EchoCenter Full Stack Startup ---"

# 1. Kill existing processes on port 8080
echo "Cleaning up port 8080..."
lsof -ti:8080 | xargs kill -9 2>/dev/null

# 2. Build and Start Backend
echo "Starting Backend (Go)..."
cd "$(dirname "$0")/.."
go build -o bin/server ./cmd/server
./bin/server &
BACKEND_PID=$!

# 3. Wait for Backend to be ready
echo "Waiting for backend to initialize..."
sleep 5

# 4. Seed Database (Registers Agents and adds history)
echo "Seeding data and registering Storage-Custodian..."
./scripts/seed_mock_data.sh

# 5. Start Python Agent (Storage-Custodian)
echo "Launching Storage-Custodian Agent..."
# Ensure dependencies are available (Assumes user has pip installed them)
python3 mock_agents/storage_custodian.py &
AGENT_PID=$!

echo "--- Startup Complete ---"
echo "Backend PID: $BACKEND_PID"
echo "Storage-Custodian PID: $AGENT_PID"
echo "Press Ctrl+C to stop everything."

# Keep script running and handle cleanup
trap "kill $BACKEND_PID $AGENT_PID; exit" INT TERM
wait
