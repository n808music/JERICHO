"""Stub for removed ai_session — v1 team system."""

import uuid
from typing import Any


def build_session_snapshot(
    state: dict[str, Any],
    pipeline_output: dict[str, Any],
    scene: dict[str, Any],
    narrative: dict[str, Any],
    directives: dict[str, Any],
    reasoning: dict[str, Any],
    chain: dict[str, Any],
    multi_goal: dict[str, Any],
    integrity_deviations: dict[str, Any],
) -> dict[str, Any]:
    """Build session snapshot."""
    return {
        "id": str(uuid.uuid4()),
        "goal": (pipeline_output or {}).get("goal"),
        "integrity": ((pipeline_output or {}).get("integrity") or {}).get("score", 0),
        "tasks": (pipeline_output or {}).get("tasks") or [],
        "narrative": narrative.get("text"),
        "directives": directives.get("directives"),
        "teamRoles": {},
    }
