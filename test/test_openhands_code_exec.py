#!/usr/bin/env python3
import asyncio
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Optional

import websockets

API_BASE = "http://localhost:8080/api"
WS_BASE = "ws://localhost:8080/api/ws"
ADMIN_USER = "admin"
ADMIN_PASS = "admin123"
DEFAULT_PROMPT = (
    "请调用 OpenHands Ops Agent，写一段可直接运行的 Python 3 代码，"
    "计算从 1 到 10 的平方和，并实际执行它。"
    "请把代码、运行输出和最终结果一起返回给我。"
)


def http_json(method: str, path: str, token: Optional[str] = None, payload: Optional[dict[str, Any]] = None) -> Any:
    url = f"{API_BASE}{path}"
    data = None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=15) as resp:
        body = resp.read().decode("utf-8")
        if not body:
            return None
        return json.loads(body)


def login() -> tuple[str, dict[str, Any]]:
    result = http_json("POST", "/auth/login", payload={"username": ADMIN_USER, "password": ADMIN_PASS})
    token = result["token"]
    user = result["user"]
    return token, user


def get_butler(token: str) -> dict[str, Any]:
    return http_json("GET", "/users/butler", token=token)


def get_openhands_status(token: str) -> dict[str, Any]:
    return http_json("GET", "/users/ops/status", token=token)


def get_recent_tasks(token: str) -> list[dict[str, Any]]:
    return http_json("GET", "/users/ops/tasks?limit=5", token=token)


async def run_probe(prompt: str) -> int:
    token, user = login()
    butler = get_butler(token)
    ops_status = get_openhands_status(token)

    print("== Login ==")
    print(f"admin_id={user['id']} butler_id={butler['id']} openhands_enabled={ops_status.get('enabled')} mode={ops_status.get('worker_mode')}")
    print(f"openhands_service={ops_status.get('service_url') or '<local_runner>'} reachable={ops_status.get('worker_reachable')}")

    if not ops_status.get("enabled"):
        print("OpenHands executor is disabled.")
        return 2

    ws_url = f"{WS_BASE}?token={urllib.parse.quote(token)}"
    final_chat = None
    stream_chunks: list[str] = []
    approvals = 0
    auth_action_ids: set[str] = set()
    deadline = time.time() + 120

    async with websockets.connect(ws_url, max_size=2**20, ping_interval=None) as ws:
        outbound = {
            "type": "CHAT",
            "target_id": int(butler["id"]),
            "payload": prompt,
        }
        await ws.send(json.dumps(outbound))
        print("\n== Sent Prompt ==")
        print(prompt)

        while time.time() < deadline:
            try:
                raw = await asyncio.wait_for(ws.recv(), timeout=20)
            except asyncio.TimeoutError:
                print("\nNo WebSocket message received for 20s, checking recent tasks...")
                break

            msg = json.loads(raw)
            mtype = msg.get("type")
            sender_id = msg.get("sender_id")
            target_id = msg.get("target_id")

            if mtype == "AUTH_REQUEST":
                payload = msg.get("payload") or {}
                action_id = payload.get("action_id")
                command = payload.get("command")
                if action_id and action_id not in auth_action_ids:
                    auth_action_ids.add(action_id)
                    approvals += 1
                    print("\n== AUTH_REQUEST ==")
                    print(command)
                    http_json("POST", "/chat/auth/response", token=token, payload={"action_id": action_id, "approved": True})
                    print(f"Approved action {action_id}")
                continue

            if mtype == "CHAT_STREAM" and sender_id == butler["id"] and target_id == user["id"]:
                chunk = str(msg.get("payload") or "")
                stream_chunks.append(chunk)
                if chunk.strip():
                    print(chunk, end="", flush=True)
                continue

            if mtype == "CHAT" and sender_id == butler["id"] and target_id == user["id"]:
                final_chat = str(msg.get("payload") or "")
                print("\n\n== Final CHAT ==")
                print(final_chat)
                continue

            if mtype == "CHAT_STREAM_END" and sender_id == butler["id"] and target_id == user["id"]:
                print("\n== STREAM END ==")
                break

        tasks = get_recent_tasks(token)
        for _ in range(12):
            if tasks:
                break
            await asyncio.sleep(5)
            tasks = get_recent_tasks(token)
        print("\n== Recent OpenHands Tasks ==")
        if not tasks:
            print("No tasks recorded.")
        else:
            for task in tasks[:3]:
                print(
                    f"- success={task.get('success')} mode={task.get('worker_mode')} "
                    f"task={task.get('task')} summary={task.get('summary') or task.get('error')}"
                )

    print("\n== Probe Summary ==")
    print(f"approvals={approvals} streamed_chars={sum(len(c) for c in stream_chunks)} final_chat={'yes' if final_chat else 'no'}")

    if not tasks:
        return 3
    latest = tasks[0]
    if latest.get("success"):
        return 0
    return 4


def main() -> int:
    prompt = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_PROMPT
    try:
        return asyncio.run(run_probe(prompt))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        print(f"HTTPError: {exc.code} {body}", file=sys.stderr)
        return 10
    except Exception as exc:
        print(f"Probe failed: {exc}", file=sys.stderr)
        return 11


if __name__ == "__main__":
    raise SystemExit(main())
