"""Sunday Briefing — PRD §3.7 REFLECT phase."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

from jyriko.domain.types import CapacityVector


@dataclass(frozen=True)
class BriefingInput:
    """Inputs for Sunday Briefing."""

    instance_id: str
    week_number: int
    current_capacity: CapacityVector
    anchor_goals: list[str]
    expected_energy: str | None = None


@dataclass(frozen=True)
class BriefingOutput:
    """Outputs of Sunday Briefing."""

    capacity_snapshot: str
    week_preview: str
    anchor_goals_prompt: str
    tone: str


def _build_capacity_snapshot_prompt(
    capacity: CapacityVector,
    week_number: int,
) -> str:
    """Generate prompt for capacity snapshot (mandatory opening section)."""
    day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    day_capacity = dict(zip(day_names, capacity.values))

    strongest = max(day_capacity, key=day_capacity.get)
    weakest = min(day_capacity, key=day_capacity.get)

    return (
        f"Generate the mandatory capacity snapshot opening section for Sunday Briefing. "
        f"Week {week_number}. "
        f"Strongest day: {strongest} (~{day_capacity[strongest]:.0%} capacity). "
        f"Weakest day: {weakest} (~{day_capacity[weakest]:.0%} capacity). "
        f"Per-day breakdown: {day_capacity}. "
        f"Write in plain language, informational, non-judgmental. "
        f"Never prescriptive. Under 80 words."
    )


def run_sunday_briefing(
    input: BriefingInput,
    llm_caller: Callable[[str, str], str],
) -> BriefingOutput:
    """Execute Sunday Briefing REFLECT phase.

    Mandatory sections:
      1. Capacity Snapshot (plain language, before task list)
      2. Week preview
      3. Anchor goal prompt
    """
    snapshot_prompt = _build_capacity_snapshot_prompt(
        input.current_capacity,
        input.week_number,
    )
    capacity_snapshot = llm_caller(snapshot_prompt, "informational")

    preview_prompt = (
        f"Generate a brief week preview. "
        f"Anchor goals: {input.anchor_goals}. "
        f"Expected energy: {input.expected_energy or 'normal'}. "
        f"Under 60 words."
    )
    week_preview = llm_caller(preview_prompt, "informational")

    anchor_goals_prompt = "What 1-3 goals will anchor your week?"

    return BriefingOutput(
        capacity_snapshot=capacity_snapshot,
        week_preview=week_preview,
        anchor_goals_prompt=anchor_goals_prompt,
        tone="informational",
    )
