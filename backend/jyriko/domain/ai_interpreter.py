"""Stub for removed ai_interpreter — v1 team system."""

from typing import Any


def interpret_command(
    command: dict[str, Any], state: dict[str, Any]
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Interpret AI command and return next state + effects."""
    return state, {"interpreted": True}
