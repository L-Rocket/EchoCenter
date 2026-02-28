#!/bin/bash

# EchoCenter Mock Data Seeder
# This script will:
# 1. Login as admin to get a token
# 2. Register mock agents
# 3. Send initial status reports to the dashboard
# 4. Insert initial chat history for EVERY agent dynamically

API_URL="http://localhost:8080/api"
ADMIN_USER="admin"
ADMIN_PASS="admin123"
DB_FILE="data/echocenter.db"

echo "--- EchoCenter Seeder ---"

# 1. Login
echo "Logging in as admin..."
LOGIN_RES=$(curl -s -X POST $API_URL/auth/login \
     -H "Content-Type: application/json" \
     -d "{\"username\": \"$ADMIN_USER\", \"password\": \"$ADMIN_PASS\"}")

TOKEN=$(echo $LOGIN_RES | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
    echo "Error: Could not get admin token. Response: $LOGIN_RES"
    exit 1
fi

echo "Login successful."

# 2. Register Butler (ID should be 2)
echo "Registering Butler..."
curl -s -X POST $API_URL/users/agents \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer $TOKEN" \
     -d '{"username": "Butler"}' > /dev/null

# 3. Register Agents
declare -a AGENTS=("Weather-Sentinel" "Code-Reviewer-AI" "Security-Audit-Bot" "Echo-Bot" "Storage-Custodian")

for agent in "${AGENTS[@]}"; do
    echo "Registering/Verifying agent: $agent..."
    curl -s -X POST $API_URL/users/agents \
         -H "Content-Type: application/json" \
         -H "Authorization: Bearer $TOKEN" \
         -d "{\"username\": \"$agent\"}" > /dev/null
done

# 4. Ingest Mock Status Messages (Dashboard)
echo "Populating dashboard with initial records..."

curl -s -X POST $API_URL/messages \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer $TOKEN" \
     -d '{"agent_id": "Weather-Sentinel", "level": "INFO", "content": "Atmospheric pressure stabilized. Scanning horizon..."}'

curl -s -X POST $API_URL/messages \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer $TOKEN" \
     -d '{"agent_id": "Code-Reviewer-AI", "level": "WARNING", "content": "Found 3 deprecated imports in backend/go.mod. Optimization recommended."}'

curl -s -X POST $API_URL/messages \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer $TOKEN" \
     -d '{"agent_id": "Echo-Bot", "level": "INFO", "content": "[Handshake] Hello operator! I am connected via WebSocket and ready to reflect your commands."}'

# 5. Mock Chat History (Dynamic IDs)
echo "Seeding initial chat history for all agents..."

# Clear existing history first to avoid mess
sqlite3 $DB_FILE "DELETE FROM chat_messages;"

ADMIN_ID=1

for agent in "${AGENTS[@]}"; do
    # Get ID for this agent
    AGENT_ID=$(sqlite3 $DB_FILE "SELECT id FROM users WHERE username='$agent';")
    
    if [ ! -z "$AGENT_ID" ]; then
        echo "  > Adding history for $agent (ID: $AGENT_ID)"
        sqlite3 $DB_FILE <<EOF
INSERT INTO chat_messages (sender_id, receiver_id, content) VALUES ($AGENT_ID, $ADMIN_ID, 'Initial link established with $agent.');
INSERT INTO chat_messages (sender_id, receiver_id, content) VALUES ($ADMIN_ID, $AGENT_ID, 'Acknowledged. Report status.');
INSERT INTO chat_messages (sender_id, receiver_id, content) VALUES ($AGENT_ID, $ADMIN_ID, 'Status: NOMINAL. Ready for commands.');
EOF
    fi
done

echo -e "\n--- Seeding Complete ---"
echo "Refresh your dashboard. All agents now have history!"
