"""Cognitive load computation — PRD §3.3."""
from __future__ import annotations

from jyriko.constants import (
    DEPENDENCY_POSITION_WEIGHTS,
    DURATION_MULTIPLIERS,
    USER_OVERRIDE_LOAD_BONUS,
)


def _duration_key(duration_minutes: int) -> str:
    if duration_minutes <= 30:
        return "lte_30"
    if duration_minutes <= 60:
        return "31_to_60"
    if duration_minutes <= 90:
        return "61_to_90"
    return "gt_90"


def _dependency_key(dependent_count: int) -> str:
    if dependent_count == 0:
        return "no_dependents"
    if dependent_count <= 2:
        return "one_to_two"
    return "three_plus"


def compute_cognitive_load(
    task_type_baseline: float,
    duration_minutes: int,
    dependent_count: int,
    user_override: bool = False,
) -> float:
    """Cognitive load clamped to [0.0, 1.0]; weights task type by duration + dependency position."""
    duration_mult = DURATION_MULTIPLIERS[_duration_key(duration_minutes)]
    dependency_mult = DEPENDENCY_POSITION_WEIGHTS[_dependency_key(dependent_count)]
    override_bonus = USER_OVERRIDE_LOAD_BONUS if user_override else 0.0
    raw = task_type_baseline * duration_mult * dependency_mult + override_bonus
    return min(max(raw, 0.0), 1.0)
