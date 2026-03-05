#!/bin/bash

set -e

# EchoCenter Mock Data Seeder (API-only)
# This script will:
# 1. Login as admin to get a token
# 2. Register Butler and mock agents
# 3. Seed dashboard log records
# 4. Seed chat history:
#    - Admin <-> Agent

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

# 2. Register Butler (idempotent, no mock conversation seeding below)
echo "Registering Butler..."
api_post "/users/agents" '{"username":"Butler"}' > /dev/null

# 3. Register Agents
declare -a AGENTS=(
    "Weather-Sentinel"
    "Code-Reviewer-AI"
    "Security-Audit-Bot"
    "Echo-Bot"
    "Storage-Custodian"
)
declare -a AGENT_TOKENS=(
    "mock-weather-sentinel-token"
    "mock-code-reviewer-ai-token"
    "mock-security-audit-bot-token"
    "mock-echo-bot-token"
    "mock-storage-custodian-token"
)
for i in "${!AGENTS[@]}"; do
    agent="${AGENTS[$i]}"
    token="${AGENT_TOKENS[$i]}"
    echo "Registering/Verifying agent: $agent..."
    api_post "/users/agents" "{\"username\":\"$agent\",\"api_token\":\"$token\"}" > /dev/null
done

# 4. Seed Dashboard Logs
echo "Populating dashboard with rich mock records..."
for agent in "${AGENTS[@]}"; do
    api_post "/messages" "{\"agent_id\":\"$agent\",\"level\":\"INFO\",\"content\":\"$agent heartbeat nominal and ready for dispatch.\"}" > /dev/null
    api_post "/messages" "{\"agent_id\":\"$agent\",\"level\":\"INFO\",\"content\":\"$agent completed scheduled diagnostics pass.\"}" > /dev/null
    api_post "/messages" "{\"agent_id\":\"$agent\",\"level\":\"WARNING\",\"content\":\"$agent detected minor drift in response latency and applied mitigation.\"}" > /dev/null
    api_post "/messages" "{\"agent_id\":\"$agent\",\"level\":\"INFO\",\"content\":\"$agent exported latest telemetry snapshot to central archive.\"}" > /dev/null
done

api_post "/messages" '{"agent_id":"Security-Audit-Bot","level":"ERROR","content":"Credential rotation check failed for one expired sandbox token."}' > /dev/null
api_post "/messages" '{"agent_id":"Code-Reviewer-AI","level":"ERROR","content":"Static analysis pipeline timed out on oversized artifact batch."}' > /dev/null
api_post "/messages" '{"agent_id":"Storage-Custodian","level":"INFO","content":"Recovered orphaned block metadata and reconciled index entries."}' > /dev/null
api_post "/messages" '{"agent_id":"Echo-Bot","level":"INFO","content":"WebSocket relay stable with no frame loss in last interval."}' > /dev/null
api_post "/messages" '{"agent_id":"Weather-Sentinel","level":"WARNING","content":"External weather API quota approaching threshold for this window."}' > /dev/null

# 5. Seed Admin <-> Agent Chats
echo "Seeding Admin-Agent chat history..."
for agent in "${AGENTS[@]}"; do
    # Storage-Custodian is a real running agent in mock bootstrap; keep its chat history clean.
    if [ "$agent" = "Storage-Custodian" ]; then
        continue
    fi
    api_post "/dev/mock/chat" "{\"sender_username\":\"$agent\",\"receiver_username\":\"$ADMIN_USER\",\"content\":\"Initial link established with $agent.\"}" > /dev/null
    api_post "/dev/mock/chat" "{\"sender_username\":\"$ADMIN_USER\",\"receiver_username\":\"$agent\",\"content\":\"Acknowledged. Report current status.\"}" > /dev/null
    api_post "/dev/mock/chat" "{\"sender_username\":\"$agent\",\"receiver_username\":\"$ADMIN_USER\",\"content\":\"Status nominal. Task queue is clear.\"}" > /dev/null
done

echo ""
echo "--- Seeding Complete ---"
echo "Dashboard logs and Admin-Agent conversations are now populated."
echo "Mock agent tokens:"
for i in "${!AGENTS[@]}"; do
    echo "  - ${AGENTS[$i]} => ${AGENT_TOKENS[$i]}"
done
