"""Stub for removed scene_compiler — v1 team system."""

from typing import Any


def compile_scene_graph(pipeline_result: dict[str, Any]) -> dict[str, Any]:
    """Build a scene graph from pipeline output."""
    return {
        "nodes": [],
        "edges": [],
        "goal": pipeline_result.get("goal"),
        "integrityScore": (pipeline_result.get("integrity") or {}).get("score", 0),
        "taskCount": len(pipeline_result.get("tasks") or []),
    }
