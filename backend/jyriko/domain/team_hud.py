"""Stub for removed team_hud — v1 team system."""

from typing import Any


def build_team_hud(session: dict[str, Any]) -> dict[str, Any]:
    """Build team HUD."""
    return {"hud": [], "summary": None}


def build_team_export(session: dict[str, Any]) -> dict[str, Any]:
    """Build team export."""
    return {"export": session, "format": "jericho-v1"}
