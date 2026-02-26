#!/bin/bash

# EchoCenter Mock Data Seeder
# This script will:
# 1. Login as admin to get a token
# 2. Register 3 mock agents
# 3. Send initial status reports and "chat-like" greetings to the dashboard

API_URL="http://localhost:8080/api"
ADMIN_USER="admin"
ADMIN_PASS="admin123"

echo "--- EchoCenter Seeder ---"

# 1. Login
echo "Logging in as admin..."
LOGIN_RES=$(curl -s -X POST $API_URL/auth/login \
     -H "Content-Type: application/json" \
     -d "{\"username\": \"$ADMIN_USER\", \"password\": \"$ADMIN_PASS\"}")

TOKEN=$(echo $LOGIN_RES | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
    echo "Error: Could not get admin token. Response: $LOGIN_RES"
    echo "Is the server running and admin initialized?"
    exit 1
fi

echo "Login successful."

# 2. Register Agents
declare -a AGENTS=("Weather-Sentinel" "Code-Reviewer-AI" "Security-Audit-Bot" "Echo-Bot")

for agent in "${AGENTS[@]}"; do
    echo "Registering agent: $agent..."
    REG_RES=$(curl -s -X POST $API_URL/users/agents \
         -H "Content-Type: application/json" \
         -H "Authorization: Bearer $TOKEN" \
         -d "{\"username\": \"$agent\"}")
    
    AGENT_TOKEN=$(echo $REG_RES | grep -o '"api_token":"[^"]*' | cut -d'"' -f4)
    echo "  > $agent Token: $AGENT_TOKEN"
done

# 3. Ingest Mock Status Messages (Dashboard)
echo "Populating dashboard with initial records..."

# Standard Status Reports
curl -s -X POST $API_URL/messages \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer $TOKEN" \
     -d '{"agent_id": "Weather-Sentinel", "level": "INFO", "content": "Atmospheric pressure stabilized. Scanning horizon..."}'

curl -s -X POST $API_URL/messages \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer $TOKEN" \
     -d '{"agent_id": "Code-Reviewer-AI", "level": "WARNING", "content": "Found 3 deprecated imports in backend/go.mod. Optimization recommended."}'

# Interactive-style messages from Agents
curl -s -X POST $API_URL/messages \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer $TOKEN" \
     -d '{"agent_id": "Echo-Bot", "level": "INFO", "content": "[Handshake] Hello operator! I am connected via WebSocket and ready to reflect your commands."}'

curl -s -X POST $API_URL/messages \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer $TOKEN" \
     -d '{"agent_id": "Security-Audit-Bot", "level": "ERROR", "content": "[Alert] Unauthorized access attempt detected from 192.168.1.105. Blocking IP..."}'

curl -s -X POST $API_URL/messages \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer $TOKEN" \
     -d '{"agent_id": "Weather-Sentinel", "level": "INFO", "content": "System Update: New satellite feed integrated. High-resolution imagery available."}'

curl -s -X POST $API_URL/messages \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer $TOKEN" \
     -d '{"agent_id": "Code-Reviewer-AI", "level": "INFO", "content": "Routine Check: All internal package dependencies are verified and up to date."}'

echo -e "\n--- Seeding Complete ---"
echo "Refresh your dashboard to see the agents and new activity logs."
