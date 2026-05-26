"""
Viability engine — PRD §3.2.

Determines whether a task's scheduled load is sustainable and whether
a Viability Pause should be triggered.
"""

from __future__ import annotations

from typing import Literal

from jyriko.constants import (
    OVERLOADED_THRESHOLD,
    VIABLE_THRESHOLD,
    VIABILITY_PAUSE_DEADLINE_DAYS,
    VIABILITY_PAUSE_DEADLINE_DEFERRAL,
    VIABILITY_PAUSE_DEFERRAL_HIGH,
    VIABILITY_PAUSE_DEFERRAL_LOW,
)
from jyriko.domain.types import Task


VIABILITY_PAUSE_PROMPTS: dict[str, str] = {
    "low": (
        "This task has been moving around — let's make sure its shape still fits your week. "
        "Do you want to break it down, push the date, or set it aside?"
    ),
    "high": (
        "This task has a deadline approaching and keeps getting rescheduled. "
        "Let's take a closer look: decompose it further, extend the deadline, or archive it?"
    ),
}


def compute_load_ratio(daily_load: float, capacity: float) -> float:
    if capacity <= 0:
        return float("inf")
    return daily_load / capacity


ViabilityLabel = Literal["viable", "overloaded", "infeasible"]


def check_viability(load_ratio: float) -> ViabilityLabel:
    """Classify a load ratio per PRD §3.2 thresholds."""
    if load_ratio > OVERLOADED_THRESHOLD:
        return "infeasible"
    if load_ratio >= VIABLE_THRESHOLD:
        return "overloaded"
    return "viable"


UrgencyLevel = Literal["low", "high"]


def should_trigger_viability_pause(
    task: Task,
    deadline_within_days: int | None,
) -> tuple[bool, UrgencyLevel] | tuple[Literal[False], None]:
    """Return (True, urgency) when a pause is warranted, (False, None) otherwise.

    Rule priority (PRD §3.2):
      1. ≥ DEFERRAL_HIGH deferrals           → high (beats all other rules)
      2. ≥ DEADLINE_DEFERRAL + deadline ≤ 7d → high
      3. ≥ DEFERRAL_LOW + no deadline        → low
    """
    d = task.deferral_count

    if d >= VIABILITY_PAUSE_DEFERRAL_HIGH:
        return (True, "high")

    if (
        d >= VIABILITY_PAUSE_DEADLINE_DEFERRAL
        and deadline_within_days is not None
        and deadline_within_days <= VIABILITY_PAUSE_DEADLINE_DAYS
    ):
        return (True, "high")

    if d >= VIABILITY_PAUSE_DEFERRAL_LOW and task.deadline is None:
        return (True, "low")

    return (False, None)


def generate_viability_pause_prompt(
    urgency: Literal["low", "high"],
    task_title: str,
    deferral_count: int,
) -> str:
    """Generate trauma-informed Viability Pause prompt per PRD §3.2."""
    base = VIABILITY_PAUSE_PROMPTS.get(urgency, VIABILITY_PAUSE_PROMPTS["low"])
    return f"Task: {task_title}\nDeferred {deferral_count} times.\n{base}"
