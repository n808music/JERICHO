"""Stub for removed llm_contract — v1 team system."""

from datetime import datetime, timezone
from typing import Any


def get_llm_contract() -> dict[str, Any]:
    """Get LLM contract version and timestamp."""
    return {
        "version": "1.0.0",
        "updatedAt": datetime.now(timezone.utc).isoformat(),
    }
