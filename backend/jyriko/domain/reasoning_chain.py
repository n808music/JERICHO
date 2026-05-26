"""Stub for removed reasoning_chain — v1 team system."""

from typing import Any


def build_reasoning_chain(
    reasoning: dict[str, Any] | None = None,
    pipeline: dict[str, Any] | None = None,
    directives: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Build reasoning chain from pipeline components."""
    return {"chain": [], "summary": "Reasoning chain not yet implemented."}
