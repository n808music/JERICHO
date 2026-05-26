"""
Weekly Rhythms router — Phase 5.

Sunday Briefing: opens with mandatory Capacity Snapshot, then the week's
tasks. Capacity Snapshot is always generated — skipping Briefing entirely
is a client-side choice; the endpoint always returns it.

Saturday Sundown: runs the full Reweave pipeline (8 steps per PRD §3.7),
updates the Capacity Profile via EWA, persists a sundown_sessions record.
"""

from __future__ import annotations

from collections.abc import Callable
from datetime import date, timedelta
from pathlib import Path
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from supabase import AsyncClient

from jyriko.db.deps import require_db_client
from jyriko.db.repositories.identity import get_identity_state, upsert_identity_day
from jyriko.db.repositories.tasks import list_tasks
from jyriko.domain.capacity_profile import apply_cold_start
from jyriko.domain.reweave import (
    SundownInput,
    compute_completion_ratio,
    compute_per_day_ratios,
    run_reweave_pipeline,
    select_tone_branch,
)
from jyriko.domain.types import CapacityVector, MomentumSignal, TaskStatus
from jyriko.llm.registry import ModelProfile, load_registry, get_model_profile

router = APIRouter(tags=["rhythms"])

_REGISTRY_PATH = Path(__file__).parent.parent.parent / "config" / "model_registry.yaml"
_REGISTRY = load_registry(_REGISTRY_PATH)

def _get_active_profile() -> ModelProfile:
    """Return the user-selected model profile from config."""
    from jyriko.config import get_settings
    return get_model_profile(get_settings().default_model_id, _REGISTRY)

_DEFERRED_STATUSES = {"rescheduled", "missed", "date_extended", "viability_pause"}


def _week_bounds(today: date) -> tuple[date, date]:
    """Return (Sunday, Saturday) for the week containing today (PRD §4.6)."""
    days_since_sunday = (today.weekday() + 1) % 7
    week_start = today - timedelta(days=days_since_sunday)
    return week_start, week_start + timedelta(days=6)


_SCHEDULED_STATUSES = {
    "scheduled",
    "in_window",
    "completed",
    "missed",
    "rescheduled",
    "viability_pause",
    "date_extended",
}


def _build_capacity_vector(identity_rows: list[dict[str, Any]]) -> CapacityVector:
    """Convert identity_state rows to CapacityVector (7 values, Mon–Sun)."""
    if not identity_rows:
        return CapacityVector(values=(0.8,) * 7)

    by_day = {row["day_of_week"]: row for row in identity_rows}
    values = tuple(
        float(by_day[d].get("derived_capacity") or by_day[d].get("declared_capacity", 0.8))
        for d in range(7)
    )
    return CapacityVector(values=values)


def _build_llm_caller(profile: ModelProfile) -> Callable[[str, str], str]:
    """Return a narrative caller backed by call_llm (stubs when base_url empty)."""
    from jyriko.llm.adapter import call_llm
    from jyriko.llm.schemas import NarrativeText

    def _caller(prompt: str, tone: str) -> str:
        result = call_llm(f"[{tone}] {prompt}", NarrativeText, profile)
        return result.text

    return _caller


# ---------------------------------------------------------------------------
# GET /rhythms/sunday-briefing
# ---------------------------------------------------------------------------


@router.get("/sunday-briefing")
async def sunday_briefing(
    instance_id: str,
    db: Annotated[AsyncClient, Depends(require_db_client)],
) -> dict[str, Any]:
    """Return Capacity Snapshot (mandatory LLM-generated) + week's task list."""
    from jyriko.domain.briefing import BriefingInput, run_sunday_briefing

    identity_rows = await get_identity_state(db, instance_id)
    tasks = await list_tasks(db, instance_id)

    capacity_vector = _build_capacity_vector(identity_rows)
    week_number = identity_rows[0]["week_number"] if identity_rows else 1

    input_data = BriefingInput(
        instance_id=instance_id,
        week_number=week_number,
        current_capacity=capacity_vector,
        anchor_goals=[],
    )

    llm_caller = _build_llm_caller(_get_active_profile())
    briefing_result = run_sunday_briefing(input_data, llm_caller)

    day_names = ("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday")
    capacity_snapshot: dict[str, Any] = {
        "narrative": briefing_result.capacity_snapshot,
        "days": [
            {"day": day_names[i], "capacity": round(v, 3)}
            for i, v in enumerate(capacity_vector.values)
        ],
        "week_number": week_number,
        "cold_start_active": week_number <= 3,
    }

    return {
        "capacity_snapshot": capacity_snapshot,
        "week_preview": briefing_result.week_preview,
        "anchor_goals_prompt": briefing_result.anchor_goals_prompt,
        "tasks": tasks,
    }


# ---------------------------------------------------------------------------
# GET /rhythms/saturday-sundown/preview
# ---------------------------------------------------------------------------


@router.get("/saturday-sundown/preview")
async def sundown_preview(
    instance_id: str,
    db: Annotated[AsyncClient, Depends(require_db_client)],
) -> dict[str, Any]:
    """Return completion_ratio + list of deferred tasks for the Sundown UI."""
    tasks = await list_tasks(db, instance_id)

    week_tasks = [t for t in tasks if t.get("status") in _SCHEDULED_STATUSES]
    statuses = [
        TaskStatus(t["status"])
        for t in week_tasks
        if t.get("status") in {s.value for s in TaskStatus}
    ]
    ratio = compute_completion_ratio(statuses)

    deferred = [t for t in tasks if t.get("status") in _DEFERRED_STATUSES]

    return {
        "completion_ratio": ratio,
        "tone_branch": select_tone_branch(ratio),
        "deferred_tasks": deferred,
        "total_scheduled": len(week_tasks),
    }


# ---------------------------------------------------------------------------
# POST /rhythms/saturday-sundown
# ---------------------------------------------------------------------------


class SaturdaySundownRequest(BaseModel):
    instance_id: str
    momentum_signal: Literal["heavy", "neutral", "light"]


@router.post("/saturday-sundown")
async def saturday_sundown(
    body: SaturdaySundownRequest,
    db: Annotated[AsyncClient, Depends(require_db_client)],
) -> dict[str, Any]:
    """Run the full 8-step Reweave pipeline and persist the session record."""
    identity_rows = await get_identity_state(db, body.instance_id)
    tasks = await list_tasks(db, body.instance_id)

    capacity_vector = _build_capacity_vector(identity_rows)
    week_number = identity_rows[0]["week_number"] if identity_rows else 1

    week_tasks = [t for t in tasks if t.get("status") in _SCHEDULED_STATUSES]
    statuses = [
        TaskStatus(t["status"])
        for t in week_tasks
        if t.get("status") in {s.value for s in TaskStatus}
    ]

    overall_ratio = compute_completion_ratio(statuses)
    completion_by_day = compute_per_day_ratios(week_tasks)

    signal = MomentumSignal(body.momentum_signal)
    inp = SundownInput(
        instance_id=body.instance_id,
        week_number=week_number,
        momentum_signal=signal,
        completed_count=sum(1 for s in statuses if s == TaskStatus.COMPLETED),
        total_scheduled=len(statuses),
        current_capacity=capacity_vector,
        completion_ratios_by_day=completion_by_day,
    )

    output = run_reweave_pipeline(inp, _build_llm_caller(_get_active_profile()))

    # Persist updated capacity profile (one row per day of week)
    for day_of_week, new_capacity in enumerate(output.updated_capacity.values):
        await upsert_identity_day(
            db,
            instance_id=body.instance_id,
            day_of_week=day_of_week,
            declared_capacity=new_capacity,
            derived_capacity=new_capacity,
            week_number=week_number + 1,
            update_source="saturday_sundown",
        )

    # Persist sundown session record
    week_start, week_end = _week_bounds(date.today())
    await (
        db.table("sundown_sessions")
        .insert(
            {
                "instance_id": body.instance_id,
                "week_number": week_number,
                "week_start": str(week_start),
                "week_end": str(week_end),
                "completion_ratio": output.completion_ratio,
                "tone_branch_used": output.tone_branch,
                "momentum_signal": body.momentum_signal,
                "narrative_summary": output.narrative_summary,
                "capacity_update_narrative": output.capacity_update_narrative,
            }
        )
        .execute()
    )

    return {
        "tone_branch": output.tone_branch,
        "completion_ratio": output.completion_ratio,
        "narrative_summary": output.narrative_summary,
        "capacity_update_narrative": output.capacity_update_narrative,
        "capacity_match_prompt": output.capacity_match_prompt,
    }
