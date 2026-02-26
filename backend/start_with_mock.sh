#!/bin/bash

# EchoCenter Startup Script with Mock Data
# This script starts the server and automatically seeds it with mock agents/data.

# 1. Ensure we are in the backend directory
cd "$(dirname "$0")"

echo "--- Starting EchoCenter with Mock Data ---"

# 2. Build the server
echo "Building server..."
go build -o echocenter_server ./cmd/server
if [ $? -ne 0 ]; then
    echo "Error: Build failed."
    exit 1
fi

# 3. Start the server in the background
echo "Launching server on :8080..."
./echocenter_server > server.log 2>&1 &
SERVER_PID=$!

# 4. Wait for server to be ready
echo "Waiting for server to initialize..."
MAX_RETRIES=10
COUNT=0
while ! curl -s http://localhost:8080/api/ping > /dev/null; do
    sleep 1
    COUNT=$((COUNT + 1))
    if [ $COUNT -ge $MAX_RETRIES ]; then
        echo "Error: Server failed to start in time. Check server.log"
        kill $SERVER_PID
        exit 1
    fi
done

# 5. Run the seeder
echo "Server is UP. Seeding mock data..."
./seed_mock_data.sh

echo -e "
--- Startup Complete ---"
echo "Server is running (PID: $SERVER_PID). Press Ctrl+C to stop."
echo "Dashboard: http://localhost:5173"
echo "Logs are being written to backend/server.log"

# 6. Wait for server process to finish (keep script alive)
trap "kill $SERVER_PID; echo 'Server stopped.'; exit" SIGINT SIGTERM
wait $SERVER_PID
