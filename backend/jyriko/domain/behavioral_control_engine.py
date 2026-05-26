"""Port of src/core/behavioral-control-engine.js — v1 pacing mode bridge."""
from typing import Any


def select_pacing_mode(
    integrity: float = 0,
    average_pressure: float = 0,
    recent_completion_rate: float = 0,
) -> dict[str, Any]:
    """
    Deterministic pacing controller.
    Bridge between v1 integrity scores and v2 Capacity Profile.
    Phase 2: replaced by derive_capacity_from_signal() in domain/capacity_profile.py.
    """
    if integrity < 40 or average_pressure > 0.6 or recent_completion_rate < 0.4:
        return {"mode": "stabilize", "maxTasksDelta": -1, "difficultyBias": -0.5}
    if integrity > 70 and average_pressure < 0.6 and recent_completion_rate >= 0.6:
        return {"mode": "advance", "maxTasksDelta": 1, "difficultyBias": 0.5}
    return {"mode": "build", "maxTasksDelta": 0, "difficultyBias": 0.0}
