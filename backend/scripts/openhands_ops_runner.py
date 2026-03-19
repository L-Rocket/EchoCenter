#!/usr/bin/env python3
import json
import os
import stat
import sys
import tempfile
from pathlib import Path


def emit(ok: bool, summary: str = "", error: str = "") -> None:
    sys.stdout.write(json.dumps({"ok": ok, "summary": summary, "error": error}))
    sys.stdout.flush()


def write_key_file(base_dir: Path, node: dict) -> Path:
    ssh_dir = base_dir / ".ssh"
    ssh_dir.mkdir(parents=True, exist_ok=True)
    key_path = ssh_dir / f"{node['name']}_id"
    key_path.write_text(node["private_key"], encoding="utf-8")
    key_path.chmod(stat.S_IRUSR | stat.S_IWUSR)
    return key_path


def build_task(payload: dict, workspace: Path) -> str:
    lines = [
        "You are the OpenHands Ops Agent for EchoCenter.",
        "Execute the requested operations task carefully.",
        "Prefer read-only inspection unless the task explicitly requires a change.",
        "Use SSH for infrastructure nodes using the provided key files.",
        "Always leave a concise RESULT.md in the workspace with findings, actions taken, and next steps.",
        "",
        f"Primary task: {payload.get('task', '').strip()}",
    ]
    reasoning = str(payload.get("reasoning", "")).strip()
    if reasoning:
        lines.append(f"Context from Butler: {reasoning}")
    lines.append("")
    lines.append("Available infrastructure nodes:")
    for node in payload.get("nodes", []):
        lines.append(
            f"- {node['name']}: ssh -i {node['key_path']} -p {node['port']} {node['ssh_user']}@{node['host']}"
        )
    lines.append("")
    lines.append(f"Workspace path: {workspace}")
    return "\n".join(lines).strip()


def run_with_openhands(payload: dict, workspace: Path) -> str:
    try:
        from openhands.sdk import Conversation
        from openhands.sdk.agent import CodeAgent
    except Exception as exc:
        raise RuntimeError(
            "OpenHands SDK is not installed. Install it in the runner environment first."
        ) from exc

    agent = CodeAgent()
    conversation = Conversation(agent=agent, workspace=str(workspace))
    conversation.send_message(build_task(payload, workspace))
    response = conversation.run()

    result_file = workspace / "RESULT.md"
    if result_file.exists():
        return result_file.read_text(encoding="utf-8").strip()
    if isinstance(response, str) and response.strip():
        return response.strip()
    return "OpenHands completed the task, but no RESULT.md was produced."


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except Exception as exc:
        emit(False, error=f"Invalid JSON payload: {exc}")
        return 1

    with tempfile.TemporaryDirectory(prefix="echocenter-openhands-") as tmpdir:
        workspace = Path(payload.get("workspace_dir") or tmpdir)
        workspace.mkdir(parents=True, exist_ok=True)
        for node in payload.get("nodes", []):
            node["key_path"] = str(write_key_file(workspace, node))

        try:
            summary = run_with_openhands(payload, workspace)
        except Exception as exc:
            emit(False, error=str(exc))
            return 1

        emit(True, summary=summary)
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
