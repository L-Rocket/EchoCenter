from __future__ import annotations

import stat
import tempfile
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
    lines.append("Before finishing, create RESULT.md with these sections: Code, Output, Final Result.")
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


async def run(request: Request) -> JSONResponse:
    try:
        payload = RunnerPayload.model_validate(await request.json())
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

            summary = run_openhands(payload, workspace, nodes)
            return JSONResponse(RunnerResponse(ok=True, summary=summary).model_dump())
    except Exception as exc:
        return JSONResponse(
            status_code=500,
            content={"ok": False, "summary": "", "error": str(exc)},
        )


app = Starlette(
    debug=False,
    routes=[
        Route("/healthz", healthz, methods=["GET"]),
        Route("/run", run, methods=["POST"]),
    ],
)
