from __future__ import annotations

import asyncio
import stat
import tempfile
import threading
import time
import uuid
from pathlib import Path
from typing import Any

from pydantic import BaseModel, Field, SecretStr
from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Route


class RunnerNode(BaseModel):
    name: str
    host: str
    port: int = 22
    ssh_user: str
    private_key: str
    public_key: str = ""


class RunnerPayload(BaseModel):
    task_id: str = ""
    task: str
    reasoning: str = ""
    model: str = ""
    base_url: str = ""
    api_key: str = ""
    workspace_dir: str = ""
    nodes: list[RunnerNode] = Field(default_factory=list)


class RunnerResponse(BaseModel):
    ok: bool
    summary: str = ""
    error: str = ""


task_lock = threading.Lock()
task_registry: dict[str, dict[str, str]] = {}


def write_key_file(base_dir: Path, node: RunnerNode) -> Path:
    ssh_dir = base_dir / ".ssh"
    ssh_dir.mkdir(parents=True, exist_ok=True)
    key_path = ssh_dir / f"{node.name}_id"
    key_path.write_text(node.private_key, encoding="utf-8")
    key_path.chmod(stat.S_IRUSR | stat.S_IWUSR)
    return key_path


def build_task(payload: RunnerPayload, workspace: Path, nodes: list[dict[str, Any]]) -> str:
    lines = [
        "You are the OpenHands Ops Agent for EchoCenter.",
        "Execute the requested operations task carefully.",
        "Prefer read-only inspection unless the task explicitly requires a change.",
        "Use SSH for infrastructure nodes using the provided key files.",
        "Always leave a concise RESULT.md in the workspace with findings, actions taken, and next steps.",
        "If the task involves writing or running code, use file-based execution and avoid fragile inline shell quoting.",
        "",
        f"Primary task: {payload.task.strip()}",
    ]
    if payload.reasoning.strip():
        lines.append(f"Context from Butler: {payload.reasoning.strip()}")
    lines.append("")
    lines.append("Available infrastructure nodes:")
    for node in nodes:
        lines.append(
            f"- {node['name']}: ssh -i {node['key_path']} -p {node['port']} {node['ssh_user']}@{node['host']}"
        )
    lines.append("")
    lines.append(f"Workspace path: {workspace}")
    lines.append("You can write files and execute shell commands inside the workspace.")
    lines.append("When you need to produce code, create a file, run it, and report the output.")
    lines.append("Always overwrite stale files instead of appending to them.")
    lines.append("Use python3 for Python scripts.")
    lines.append("Do not use inline commands like python -c or python3 -c for multi-line code.")
    lines.append("Do not print the source code from inside Python. Put the code into RESULT.md instead.")
    lines.append("Before finishing, create RESULT.md with these sections exactly: Code, Output, Final Result.")
    lines.append("After RESULT.md is written, stop immediately and return a short completion message.")
    lines.append("")
    lines.append("Recommended execution pattern for Python tasks:")
    lines.append("1. Create script.py with a heredoc such as: cat <<'PY' > script.py")
    lines.append("2. Put the Python source in script.py")
    lines.append("3. Run: python3 script.py")
    lines.append("4. Create RESULT.md separately with the code and stdout")
    lines.append("5. Finish without additional shell experiments")
    return "\n".join(lines).strip()


def normalize_model_name(model: str, base_url: str) -> str:
    model = model.strip()
    if not model:
        return model
    if "/" not in model:
        return model
    provider = model.split("/", 1)[0].lower()
    known_providers = {
        "openai",
        "anthropic",
        "azure",
        "bedrock",
        "gemini",
        "google",
        "groq",
        "huggingface",
        "ollama",
        "openrouter",
        "vertex_ai",
        "xai",
    }
    if provider in known_providers:
        return model
    if base_url.strip():
        return f"openai/{model}"
    return model


def set_task_state(task_id: str, **updates: str) -> None:
    if not task_id:
        return
    with task_lock:
        current = task_registry.setdefault(
            task_id,
            {
                "task_id": task_id,
                "status": "queued",
                "current_step": "",
                "live_output": "",
                "summary": "",
                "error": "",
            },
        )
        for key, value in updates.items():
            current[key] = value


def read_task_output(workspace: Path) -> tuple[str, str]:
    execution_log = workspace / "EXECUTION_LOG.md"
    result_file = workspace / "RESULT.md"

    if result_file.exists():
        return "Writing final result", result_file.read_text(encoding="utf-8").strip()[-12000:]
    if execution_log.exists():
        text = execution_log.read_text(encoding="utf-8").strip()
        if not text:
            return "Preparing execution", ""
        command_count = text.count("## Command")
        return f"Execution step {max(command_count, 1)}", text[-12000:]
    return "Preparing execution", ""


def track_workspace(task_id: str, workspace: Path, stop_event: threading.Event) -> None:
    while not stop_event.wait(0.5):
        step, live_output = read_task_output(workspace)
        set_task_state(task_id, status="running", current_step=step, live_output=live_output)


def run_openhands(payload: RunnerPayload, workspace: Path, nodes: list[dict[str, Any]]) -> str:
    try:
        from openhands.sdk import Agent, Conversation, LLM
        from openhands.sdk.tool import Tool, register_tool
        from echo_shell_tool import EchoShellToolDefinition
    except Exception as exc:  # pragma: no cover - import depends on image build
        raise RuntimeError(
            "OpenHands SDK is not installed in the worker image."
        ) from exc
    register_tool("EchoShellTool", EchoShellToolDefinition)

    api_key = payload.api_key.strip()
    if not api_key:
        raise RuntimeError("OpenHands model API key is empty.")

    model = normalize_model_name(payload.model, payload.base_url)
    if not model:
        raise RuntimeError("OpenHands model name is empty.")

    llm = LLM(
        usage_id="echocenter-openhands",
        model=model,
        api_key=SecretStr(api_key),
        base_url=payload.base_url.strip() or None,
    )
    agent = Agent(llm=llm, tools=[Tool(name="EchoShellTool")])
    conversation = Conversation(agent=agent, workspace=str(workspace))
    conversation.send_message(build_task(payload, workspace, nodes))
    response = conversation.run()

    result_file = workspace / "RESULT.md"
    if result_file.exists():
        return result_file.read_text(encoding="utf-8").strip()
    execution_log = workspace / "EXECUTION_LOG.md"
    if execution_log.exists():
        return execution_log.read_text(encoding="utf-8").strip()
    if isinstance(response, str) and response.strip():
        return response.strip()
    return "OpenHands completed the task, but no RESULT.md was produced."


async def healthz(_: Request) -> JSONResponse:
    return JSONResponse({"status": "ok"})


async def get_task(request: Request) -> JSONResponse:
    task_id = request.path_params.get("task_id", "")
    with task_lock:
        task = task_registry.get(task_id)
    if not task:
        return JSONResponse(status_code=404, content={"ok": False, "error": "task not found"})
    return JSONResponse({"ok": True, **task})


async def run(request: Request) -> JSONResponse:
    tracker_stop: threading.Event | None = None
    try:
        payload = RunnerPayload.model_validate(await request.json())
        task_id = payload.task_id.strip() or f"openhands-{uuid.uuid4().hex[:12]}"
        set_task_state(task_id, status="running", current_step="Booting OpenHands runtime", live_output="", summary="", error="")
        with tempfile.TemporaryDirectory(prefix="echocenter-openhands-") as tmpdir:
            base_workspace = Path(payload.workspace_dir or tmpdir)
            base_workspace.mkdir(parents=True, exist_ok=True)
            workspace = base_workspace / f"task-{uuid.uuid4().hex[:12]}"
            workspace.mkdir(parents=True, exist_ok=True)

            nodes: list[dict[str, Any]] = []
            for node in payload.nodes:
                node_data = node.model_dump()
                node_data["key_path"] = str(write_key_file(workspace, node))
                nodes.append(node_data)

            tracker_stop = threading.Event()
            tracker = threading.Thread(target=track_workspace, args=(task_id, workspace, tracker_stop), daemon=True)
            tracker.start()
            summary = await asyncio.to_thread(run_openhands, payload, workspace, nodes)
            tracker_stop.set()
            step, live_output = read_task_output(workspace)
            set_task_state(task_id, status="completed", current_step=step, live_output=live_output, summary=summary, error="")
            return JSONResponse(RunnerResponse(ok=True, summary=summary).model_dump())
    except Exception as exc:
        task_id = locals().get("task_id", "")
        if tracker_stop is not None:
            tracker_stop.set()
        set_task_state(task_id, status="failed", current_step="Execution failed", error=str(exc))
        return JSONResponse(
            status_code=500,
            content={"ok": False, "summary": "", "error": str(exc)},
        )


app = Starlette(
    debug=False,
    routes=[
        Route("/healthz", healthz, methods=["GET"]),
        Route("/tasks/{task_id}", get_task, methods=["GET"]),
        Route("/run", run, methods=["POST"]),
    ],
)
