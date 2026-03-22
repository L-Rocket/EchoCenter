#!/bin/bash

set -e

# EchoCenter Mock Data Seeder (API-only)
# This script will:
# 1. Login as admin to get a token
# 2. Register Butler and mock agents
# 3. Seed dashboard log records
# 4. Seed conversation threads and chat history
# 5. Seed operations/settings data (SSH, nodes, Feishu, OpenHands tasks)

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

api_patch() {
    local path="$1"
    local json="$2"
    curl -s -X PATCH "$API_URL$path" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $TOKEN" \
        -d "$json"
}

api_get() {
    local path="$1"
    curl -s -X GET "$API_URL$path" \
        -H "Authorization: Bearer $TOKEN"
}

json_field() {
    local key="$1"
    python3 -c '
import json, sys
key = sys.argv[1]
data = json.load(sys.stdin)
value = data
for part in key.split("."):
    if not part:
        continue
    value = value[part]
if isinstance(value, bool):
    print("true" if value else "false")
elif value is None:
    print("")
else:
    print(value)
' "$key"
}

find_agent_id() {
    local username="$1"
    python3 -c 'import json, sys; username = sys.argv[1]; agents = json.load(sys.stdin); print(next(item["id"] for item in agents if item["username"] == username))' "$username"
}

create_thread() {
    local peer_id="$1"
    local channel_kind="$2"
    local title="$3"
    local summary="$4"
    local pinned="${5:-false}"

    local create_payload
    create_payload=$(python3 - "$peer_id" "$channel_kind" "$title" <<'PY'
import json, sys
peer_id, channel_kind, title = sys.argv[1], sys.argv[2], sys.argv[3]
print(json.dumps({
    "peer_id": int(peer_id),
    "channel_kind": channel_kind,
    "title": title,
}, ensure_ascii=False))
PY
)
    local resp
    resp=$(api_post "/chat/threads" "$create_payload")
    local thread_id
    thread_id=$(printf '%s' "$resp" | json_field "id")

    local patch_payload
    patch_payload=$(python3 - "$summary" "$pinned" <<'PY'
import json, sys
summary, pinned = sys.argv[1], sys.argv[2].lower() == "true"
print(json.dumps({
    "summary": summary,
    "is_pinned": pinned,
}, ensure_ascii=False))
PY
)
    api_patch "/chat/threads/$thread_id" "$patch_payload" > /dev/null
    echo "$thread_id"
}

seed_thread_chat() {
    local thread_id="$1"
    local sender="$2"
    local receiver="$3"
    local content="$4"
    local msg_type="${5:-CHAT}"
    local payload
    payload=$(python3 - "$sender" "$receiver" "$thread_id" "$msg_type" "$content" <<'PY'
import json, sys
sender, receiver, thread_id, msg_type, content = sys.argv[1:]
print(json.dumps({
    "sender_username": sender,
    "receiver_username": receiver,
    "conversation_id": int(thread_id),
    "type": msg_type,
    "content": content,
}, ensure_ascii=False))
PY
)
    api_post "/dev/mock/chat" "$payload" > /dev/null
}

create_mock_ssh_key() {
    local name="$1"
    local tmpdir
    tmpdir="$(mktemp -d)"
    local keyfile="$tmpdir/${name// /_}"
    ssh-keygen -q -t ed25519 -N "" -f "$keyfile" >/dev/null
    local private_key public_key payload resp key_id
    private_key="$(cat "$keyfile")"
    public_key="$(cat "$keyfile.pub")"
    payload=$(python3 - "$name" "$public_key" "$private_key" <<'PY'
import json, sys
name, public_key, private_key = sys.argv[1:]
print(json.dumps({
    "name": name,
    "public_key": public_key,
    "private_key": private_key,
}, ensure_ascii=False))
PY
)
    resp=$(api_post "/users/ops/ssh-keys" "$payload")
    key_id=$(printf '%s' "$resp" | json_field "id")
    rm -rf "$tmpdir"
    echo "$key_id"
}

create_mock_node() {
    local name="$1"
    local host="$2"
    local port="$3"
    local ssh_user="$4"
    local ssh_key_id="$5"
    local description="$6"
    local payload
    payload=$(python3 - "$name" "$host" "$port" "$ssh_user" "$ssh_key_id" "$description" <<'PY'
import json, sys
name, host, port, ssh_user, ssh_key_id, description = sys.argv[1:]
print(json.dumps({
    "name": name,
    "host": host,
    "port": int(port),
    "ssh_user": ssh_user,
    "ssh_key_id": int(ssh_key_id),
    "description": description,
}, ensure_ascii=False))
PY
)
    api_post "/users/ops/nodes" "$payload" > /dev/null
}

seed_openhands_task() {
    local task="$1"
    local reasoning="$2"
    local summary="$3"
    local success="${4:-true}"
    local duration_ms="${5:-12000}"
    local payload
    payload=$(python3 - "$task" "$reasoning" "$summary" "$success" "$duration_ms" <<'PY'
import json, sys
task, reasoning, summary, success, duration_ms = sys.argv[1:]
print(json.dumps({
    "task": task,
    "reasoning": reasoning,
    "summary": summary,
    "success": success.lower() == "true",
    "worker_mode": "service",
    "duration_ms": int(duration_ms),
}, ensure_ascii=False))
PY
)
    api_post "/dev/mock/ops-task" "$payload" > /dev/null
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
declare -a AGENT_DESCRIPTIONS=(
    "Monitors weather conditions, external alerts, and environment anomalies."
    "Reviews code changes, highlights regressions, and suggests cleanup."
    "Tracks security posture, credential drift, and suspicious patterns."
    "General purpose conversational utility agent for quick coordination."
    "Maintains storage health, telemetry snapshots, and recovery workflows."
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
    description="${AGENT_DESCRIPTIONS[$i]}"
    echo "Registering/Verifying agent: $agent..."
    payload=$(python3 - "$agent" "$token" "$description" <<'PY'
import json, sys
username, token, description = sys.argv[1:]
print(json.dumps({
    "username": username,
    "api_token": token,
    "description": description,
}, ensure_ascii=False))
PY
)
    api_post "/users/agents" "$payload" > /dev/null
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

# Resolve Butler + agent ids
BUTLER_JSON=$(api_get "/users/butler")
BUTLER_ID=$(printf '%s' "$BUTLER_JSON" | json_field "id")
AGENTS_JSON=$(api_get "/users/agents")
WEATHER_ID=$(printf '%s' "$AGENTS_JSON" | find_agent_id "Weather-Sentinel")
REVIEWER_ID=$(printf '%s' "$AGENTS_JSON" | find_agent_id "Code-Reviewer-AI")
SECURITY_ID=$(printf '%s' "$AGENTS_JSON" | find_agent_id "Security-Audit-Bot")
ECHO_ID=$(printf '%s' "$AGENTS_JSON" | find_agent_id "Echo-Bot")

# 5. Seed Butler and Agent threads
echo "Seeding conversation threads..."
BUTLER_RUNTIME_THREAD=$(create_thread "$BUTLER_ID" "butler_direct" "Runtime Audit Desk" "Review OpenHands delegations, approvals, and execution summaries." "true")
seed_thread_chat "$BUTLER_RUNTIME_THREAD" "$ADMIN_USER" "Butler" "帮我准备一个今天的运行时总览，重点看执行链、审批和异常。"
seed_thread_chat "$BUTLER_RUNTIME_THREAD" "Butler" "$ADMIN_USER" "今天的运行时链路总体稳定。OpenHands 最近完成了多次代码与巡检任务，审批链路全部可追踪，暂未发现阻塞性异常。"

BUTLER_AUTOMATION_THREAD=$(create_thread "$BUTLER_ID" "butler_direct" "Python Scratchpad" "Ask Butler to draft and execute small code snippets through OpenHands." "false")
seed_thread_chat "$BUTLER_AUTOMATION_THREAD" "$ADMIN_USER" "Butler" "请写一段 Python 代码计算最近 7 天异常数平均值。"
seed_thread_chat "$BUTLER_AUTOMATION_THREAD" "Butler" "$ADMIN_USER" "可以，我会把这类代码任务委派给 OpenHands，并把代码和结果一起带回来。"

BUTLER_COORD_THREAD=$(create_thread "$BUTLER_ID" "butler_direct" "Agent Coordination Notes" "Cross-agent coordination thread focused on monitoring and delegation." "false")
seed_thread_chat "$BUTLER_COORD_THREAD" "$ADMIN_USER" "Butler" "今天如果有新的安全告警，先通知我，再看要不要委派处理。"
seed_thread_chat "$BUTLER_COORD_THREAD" "Butler" "$ADMIN_USER" "已记录。我会优先整理告警摘要，再决定是否需要委派给对应 Agent 或 OpenHands。"

echo "Seeding Admin-Agent chat history..."
WEATHER_THREAD=$(create_thread "$WEATHER_ID" "agent_direct" "Weather Watch" "Track incoming weather alerts and field environment risk." "true")
seed_thread_chat "$WEATHER_THREAD" "$ADMIN_USER" "Weather-Sentinel" "今天外部天气链路稳定吗？"
seed_thread_chat "$WEATHER_THREAD" "Weather-Sentinel" "$ADMIN_USER" "目前链路正常，但 API 配额逼近阈值，建议继续观察。"

REVIEW_THREAD=$(create_thread "$REVIEWER_ID" "agent_direct" "Refactor Review" "Code review workspace for regression checks and cleanup follow-ups." "false")
seed_thread_chat "$REVIEW_THREAD" "$ADMIN_USER" "Code-Reviewer-AI" "看一下最近这轮前端重构有没有明显回归风险。"
seed_thread_chat "$REVIEW_THREAD" "Code-Reviewer-AI" "$ADMIN_USER" "主要风险在聊天工作区的状态同步和页面密度，我已经标出了几个需要继续观察的区域。"

SECURITY_THREAD=$(create_thread "$SECURITY_ID" "agent_direct" "Security Sweep" "Security audit workspace for connector, token, and policy review." "false")
seed_thread_chat "$SECURITY_THREAD" "$ADMIN_USER" "Security-Audit-Bot" "把最近的凭据和节点接入风险给我列个摘要。"
seed_thread_chat "$SECURITY_THREAD" "Security-Audit-Bot" "$ADMIN_USER" "目前主要风险是测试节点仍在使用开发期 SSH key，建议上线前统一轮换。"

# Keep some classic direct chat history for the other agents as well.
for agent in "${AGENTS[@]}"; do
    # Storage-Custodian is a real running agent in mock bootstrap; keep its chat history clean.
    if [ "$agent" = "Storage-Custodian" ]; then
        continue
    fi
    api_post "/dev/mock/chat" "{\"sender_username\":\"$agent\",\"receiver_username\":\"$ADMIN_USER\",\"content\":\"Initial link established with $agent.\"}" > /dev/null
    api_post "/dev/mock/chat" "{\"sender_username\":\"$ADMIN_USER\",\"receiver_username\":\"$agent\",\"content\":\"Acknowledged. Report current status.\"}" > /dev/null
    api_post "/dev/mock/chat" "{\"sender_username\":\"$agent\",\"receiver_username\":\"$ADMIN_USER\",\"content\":\"Status nominal. Task queue is clear.\"}" > /dev/null
done

# 6. Seed settings data: SSH keys, nodes, Feishu connector
echo "Seeding operations/settings data..."
PRIMARY_KEY_ID=$(create_mock_ssh_key "Primary Bastion Key")
STAGING_KEY_ID=$(create_mock_ssh_key "Staging Fleet Key")

create_mock_node "prod-web-01" "10.20.0.14" "22" "ubuntu" "$PRIMARY_KEY_ID" "Primary nginx ingress node serving production traffic."
create_mock_node "staging-worker-02" "10.30.4.22" "22" "deploy" "$STAGING_KEY_ID" "Background worker used for staging task execution and smoke checks."
create_mock_node "db-readonly-01" "10.20.8.11" "2222" "postgres" "$PRIMARY_KEY_ID" "Readonly analytics replica for diagnostics and reporting."

FEISHU_CONNECTOR_JSON=$(api_post "/integrations/feishu" "$(python3 - <<'PY'
import json
print(json.dumps({
    "connector_name": "Ops Bridge",
    "app_id": "cli_mock_app_id",
    "app_secret": "cli_mock_app_secret",
    "verification_token": "mock-verification-token",
    "encrypt_key": "mock-encrypt-key",
    "allow_dm": True,
    "allow_group_mention": True,
    "mention_required": True,
    "prefix_command": "/butler",
    "ignore_bot_messages": True,
    "rate_limit_per_minute": 24,
    "allowed_chat_ids": ["oc_mock_ops_room", "oc_mock_release_room"],
    "callback_url": "https://mock.echocenter.local/feishu/callback",
}, ensure_ascii=False))
PY
)")
FEISHU_CONNECTOR_ID=$(printf '%s' "$FEISHU_CONNECTOR_JSON" | json_field "id")
api_post "/integrations/feishu/$FEISHU_CONNECTOR_ID/test-message" '{"target_chat_id":"oc_mock_ops_room","text":"Mock test message accepted for operations room."}' > /dev/null
api_post "/dev/mock/feishu-log" '{"level":"info","action":"ws_connecting","detail":"Mock WebSocket bridge connected to Feishu sandbox domain."}' > /dev/null
api_post "/dev/mock/feishu-log" '{"level":"warning","action":"callback_verification_reset","detail":"Callback verification was reset after connector settings changed during development."}' > /dev/null
api_post "/dev/mock/feishu-log" '{"level":"success","action":"test_message","detail":"Sent a synthetic approval-card test message to the mock ops room."}' > /dev/null

# 7. Seed recent OpenHands tasks for the operations console
echo "Seeding OpenHands task history..."
seed_openhands_task \
    "write_and_run_code" \
    "Butler delegated a quick numerical calculation to the runtime." \
    $'Code:\n\n```py\nsum = 0\nfor i in range(1, 11):\n    sum += i ** 2\nprint(sum)\n```\n\nOutput:\n\n```text\n385\n```\n\nFinal Result:\n\n```text\n385\n```' \
    "true" \
    "22170"
seed_openhands_task \
    "inspect_service_status" \
    "Check service readiness on staging-worker-02 before release window." \
    $'Command:\n\n```sh\nssh -i staging_key -p 22 deploy@10.30.4.22 systemctl status worker.service --no-pager\n```\n\nstdout:\n\n```text\nworker.service is active (running)\n```\n\nFinal Result:\n\n```text\nStaging worker is healthy and ready for rollout.\n```' \
    "true" \
    "11840"
seed_openhands_task \
    "collect_nginx_error_context" \
    "Gather the latest nginx error details from prod-web-01 for Butler to summarize." \
    $'Command:\n\n```sh\nssh -i bastion_key ubuntu@10.20.0.14 tail -n 80 /var/log/nginx/error.log\n```\n\nstderr:\n\n```text\n2026/03/19 upstream timed out while reading response header\n```\n\nFinal Result:\n\n```text\nNginx is reachable, but one upstream timeout was observed and should be investigated.\n```' \
    "true" \
    "16320"

echo ""
echo "--- Seeding Complete ---"
echo "Dashboard logs, threaded conversations, settings data, and OpenHands task history are now populated."
echo "Mock agent tokens:"
for i in "${!AGENTS[@]}"; do
    echo "  - ${AGENTS[$i]} => ${AGENT_TOKENS[$i]}"
done
