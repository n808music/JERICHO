"""Stub for removed team_roles — v1 team system."""

from typing import Any


def filter_session_for_viewer(
    session: dict[str, Any],
    viewer_id: str | None,
    team_roles: Any,
    context: str,
) -> dict[str, Any]:
    """Filter session for viewer."""
    return session
