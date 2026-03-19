from __future__ import annotations

import os
import subprocess
from pathlib import Path

from pydantic import Field

from openhands.sdk.llm import TextContent
from openhands.sdk.tool import Action, Observation, ToolDefinition, ToolExecutor


class EchoShellAction(Action):
    command: str = Field(description="Shell command to execute inside the workspace.")


class EchoShellObservation(Observation):
    exit_code: int
    stdout: str = ""
    stderr: str = ""

    @property
    def to_llm_content(self):
        parts = [f"exit_code={self.exit_code}"]
        if self.stdout.strip():
            parts.append(f"stdout:\n{self.stdout.strip()}")
        if self.stderr.strip():
            parts.append(f"stderr:\n{self.stderr.strip()}")
        return [TextContent(text="\n\n".join(parts).strip())]


class EchoShellExecutor(ToolExecutor[EchoShellAction, EchoShellObservation]):
    def __init__(self, working_dir: Path):
        self.working_dir = working_dir

    def __call__(self, action: EchoShellAction, conversation=None) -> EchoShellObservation:
        result = subprocess.run(
            action.command,
            cwd=self.working_dir,
            shell=True,
            text=True,
            capture_output=True,
            timeout=120,
            env={
                **os.environ,
                "PYTHONUNBUFFERED": "1",
            },
        )
        return EchoShellObservation(
            exit_code=result.returncode,
            stdout=result.stdout[-12000:],
            stderr=result.stderr[-12000:],
        )


class EchoShellToolDefinition(ToolDefinition[EchoShellAction, EchoShellObservation]):
    @classmethod
    def create(cls, conv_state=None, **params):
        if conv_state is None:
            raise ValueError("conv_state is required for EchoShellToolDefinition")
        description = (
            "Execute a shell command inside the current workspace. "
            "Use this to create files, run Python scripts, inspect outputs, and gather results."
        )
        return [
            cls(
                description=description,
                action_type=EchoShellAction,
                observation_type=EchoShellObservation,
                executor=EchoShellExecutor(Path(conv_state.workspace.working_dir)),
            )
        ]
