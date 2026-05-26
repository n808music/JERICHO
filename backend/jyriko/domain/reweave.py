"""
Saturday Sundown Reweave pipeline — Phase 5.

The Reweave is the system's longitudinal learning loop: it updates the
Capacity Profile each week using actual completion evidence + subjective
momentum signal, then closes with a mandatory transparency narrative.

Tone branching (PRD §3.7):
  completion_ratio > 0.70  → momentum    (celebration framing)
  completion_ratio 0.40–0.70 → balanced  (acknowledgment framing)
  completion_ratio < 0.40  → recalibration (neutral framing)

Boundary decision (encoded in tests): 0.70 itself is "balanced", not
"momentum" — the spec uses strict inequality (>0.70).
"""
from __future__ import annotations

from collections.abc import Callable, Sequence
from dataclasses import dataclass
from datetime import date as _Date
from typing import Any, Literal

from jyriko.constants import EWA_ALPHA
from jyriko.domain.capacity_profile import compute_ewa, derive_capacity_from_signal
from jyriko.domain.types import CapacityVector, MomentumSignal, TaskStatus

ToneBranch = Literal["momentum", "balanced", "recalibration"]

_CAPACITY_MATCH_PROMPT = (
    "Does this match how your week felt? (yes / no / somewhat)"
)


@dataclass(frozen=True)
class SundownInput:
    """All inputs required to run a Saturday Sundown Reweave."""
    instance_id: str
    week_number: int
    momentum_signal: MomentumSignal
    completed_count: int
    total_scheduled: int
    current_capacity: CapacityVector
    completion_ratios_by_day: tuple[float, ...]  # 7 values, Mon(0)–Sun(6)


@dataclass(frozen=True)
class SundownOutput:
    """Outputs of a completed Reweave pipeline."""
    tone_branch: ToneBranch
    completion_ratio: float
    updated_capacity: CapacityVector
    narrative_summary: str
    capacity_update_narrative: str
    capacity_match_prompt: str


def compute_per_day_ratios(tasks: Sequence[dict[str, Any]]) -> tuple[float, ...]:
    """Completion ratio per day-of-week (Mon=0..Sun=6) from task row dicts."""
    completed: dict[int, int] = {i: 0 for i in range(7)}
    total: dict[int, int] = {i: 0 for i in range(7)}
    for t in tasks:
        sd = t.get("scheduled_date")
        if not sd:
            continue
        dow = _Date.fromisoformat(str(sd)).weekday()
        total[dow] += 1
        if t.get("status") == "completed":
            completed[dow] += 1
    return tuple(
        completed[i] / total[i] if total[i] > 0 else 0.0
        for i in range(7)
    )


def compute_completion_ratio(statuses: Sequence[TaskStatus]) -> float:
    """Fraction of scheduled tasks that were completed."""
    if not statuses:
        return 0.0
    completed = sum(1 for s in statuses if s == TaskStatus.COMPLETED)
    return completed / len(statuses)


def select_tone_branch(completion_ratio: float) -> ToneBranch:
    """Choose the LLM prompt tone based on weekly completion ratio."""
    if completion_ratio > 0.70:
        return "momentum"
    if completion_ratio >= 0.40:
        return "balanced"
    return "recalibration"


def run_reweave_pipeline(
    sundown_input: SundownInput,
    llm_caller: Callable[[str, str], str],
) -> SundownOutput:
    """Execute the 8-step Saturday Sundown pipeline.

    *llm_caller* is injected — signature: (prompt, tone_branch) -> narrative str.
    Pure except for the injected LLM call.

    Steps:
      1. Compute completion_ratio from counts
      2. Select tone branch
      3. Derive updated capacity via EWA + momentum signal
      4. Generate narrative summary via LLM
      5. Generate capacity update narrative via LLM
      6. Return SundownOutput with capacity_match_prompt
    """
    inp = sundown_input

    # Step 1: completion ratio
    ratio = inp.completed_count / inp.total_scheduled if inp.total_scheduled > 0 else 0.0

    # Step 2: tone branch
    tone = select_tone_branch(ratio)

    # Step 3: update capacity via EWA using per-day completion ratios
    updated_capacity = derive_capacity_from_signal(
        current_vector=inp.current_capacity,
        completion_ratios=inp.completion_ratios_by_day,
        momentum_signal=inp.momentum_signal,
        capacity_match=True,  # default — overridden next cycle via stored response
    )

    # Steps 4–5: LLM-generated narratives (injected, tone-branched)
    narrative_summary = llm_caller(
        _build_narrative_prompt(inp, ratio, tone),
        tone,
    )
    capacity_update_narrative = llm_caller(
        _build_capacity_prompt(inp.current_capacity, updated_capacity, tone),
        tone,
    )

    return SundownOutput(
        tone_branch=tone,
        completion_ratio=ratio,
        updated_capacity=updated_capacity,
        narrative_summary=narrative_summary,
        capacity_update_narrative=capacity_update_narrative,
        capacity_match_prompt=_CAPACITY_MATCH_PROMPT,
    )


# ---------------------------------------------------------------------------
# Prompt builders (pure helpers — no I/O)
# ---------------------------------------------------------------------------

def _build_narrative_prompt(
    inp: SundownInput,
    ratio: float,
    tone: ToneBranch,
) -> str:
    pct = int(ratio * 100)
    return (
        f"Generate a {tone} weekly retrospective. "
        f"The user completed {pct}% of their scheduled tasks this week "
        f"(signal: {inp.momentum_signal.value}). "
        f"Week number: {inp.week_number}. "
        f"Keep it under 80 words. Plain language, non-judgmental."
    )


def _build_capacity_prompt(
    before: CapacityVector,
    after: CapacityVector,
    tone: ToneBranch,
) -> str:
    day_names = ("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday")
    changes = [
        f"{day}: {'+' if a > b else ''}{(a - b):.2f}"
        for day, b, a in zip(day_names, before.values, after.values)
        if abs(a - b) > 0.001
    ]
    change_text = ", ".join(changes) if changes else "no significant changes"
    return (
        f"Generate a matter-of-fact capacity update summary. "
        f"Changes this week: {change_text}. "
        f"Tone: {tone}. Under 60 words."
    )
