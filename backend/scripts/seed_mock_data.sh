#!/bin/bash

set -e

# EchoCenter Mock Data Seeder (API-only)
# This script will:
# 1. Login as admin to get a token
# 2. Register mock agents
# 3. Send initial status reports to the dashboard
# 4. Insert initial chat history through dev API endpoints

API_URL="${API_URL:-http://localhost:8080/api}"
ADMIN_USER="${ADMIN_USER:-admin}"
ADMIN_PASS="${ADMIN_PASS:-admin123}"

echo "--- EchoCenter Seeder (API-only) ---"
echo "API: $API_URL"

api_post() {
    local path="$1"
    local json="$2"
    curl -s -X POST "$API_URL$path" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $TOKEN" \
        -d "$json"
}

# 1. Login
echo "Logging in as admin..."
LOGIN_RES=$(curl -s -X POST "$API_URL/auth/login" \
     -H "Content-Type: application/json" \
     -d "{\"username\": \"$ADMIN_USER\", \"password\": \"$ADMIN_PASS\"}")

TOKEN=$(echo "$LOGIN_RES" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
if [ -z "$TOKEN" ]; then
    echo "Error: Could not get admin token. Response: $LOGIN_RES"
    exit 1
fi
echo "Login successful."

# 2. Register Butler (idempotent)
echo "Registering Butler..."
api_post "/users/agents" '{"username":"Butler"}' > /dev/null

# 3. Register Agents
declare -a AGENTS=("Weather-Sentinel" "Code-Reviewer-AI" "Security-Audit-Bot" "Echo-Bot" "Storage-Custodian")
for agent in "${AGENTS[@]}"; do
    echo "Registering/Verifying agent: $agent..."
    api_post "/users/agents" "{\"username\":\"$agent\"}" > /dev/null
done

# 4. Ingest Mock Status Messages
echo "Populating dashboard with initial records..."
api_post "/messages" '{"agent_id":"Weather-Sentinel","level":"INFO","content":"Atmospheric pressure stabilized. Scanning horizon..."}' > /dev/null
api_post "/messages" '{"agent_id":"Code-Reviewer-AI","level":"WARNING","content":"Found 3 deprecated imports in backend/go.mod. Optimization recommended."}' > /dev/null
api_post "/messages" '{"agent_id":"Echo-Bot","level":"INFO","content":"[Handshake] Hello operator! I am connected via WebSocket and ready to reflect your commands."}' > /dev/null

# 5. Seed Chat History via Dev API
echo "Seeding initial chat history for all agents..."
for agent in "${AGENTS[@]}"; do
    echo "  > Adding history for $agent"
    api_post "/dev/mock/chat" "{\"sender_username\":\"$agent\",\"receiver_username\":\"$ADMIN_USER\",\"content\":\"Initial link established with $agent.\"}" > /dev/null
    api_post "/dev/mock/chat" "{\"sender_username\":\"$ADMIN_USER\",\"receiver_username\":\"$agent\",\"content\":\"Acknowledged. Report status.\"}" > /dev/null
    api_post "/dev/mock/chat" "{\"sender_username\":\"$agent\",\"receiver_username\":\"$ADMIN_USER\",\"content\":\"Status: NOMINAL. Ready for commands.\"}" > /dev/null
done

echo ""
echo "--- Seeding Complete ---"
echo "Refresh your dashboard. All agents now have history!"
