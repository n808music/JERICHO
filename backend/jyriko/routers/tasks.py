from datetime import date
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from supabase import AsyncClient

from jyriko.db.deps import require_db_client
from jyriko.db.json_adapter import safe_read_state, write_state
from jyriko.db.repositories import tasks as tasks_repo
from jyriko.domain.state_machine import InvalidTransitionError, transition
from jyriko.domain.types import Task, TaskStatus
from jyriko.domain.viability import generate_viability_pause_prompt, should_trigger_viability_pause

router = APIRouter(tags=["tasks"])


# ---------------------------------------------------------------------------
# Helpers for Supabase-backed endpoints
# ---------------------------------------------------------------------------


def _to_domain_task(row: dict[str, Any]) -> Task:
    return Task(
        id=row["id"],
        goal_id=row["goal_id"],
        title=row["title"],
        status=TaskStatus(row["status"]),
        task_type=row["task_type"],
        importance_tier=row["importance_tier"],
        estimated_duration_minutes=row["estimated_duration_minutes"],
        cognitive_load=float(row["cognitive_load"]),
        deferral_count=int(row.get("deferral_count", 0)),
        dependencies=tuple(row.get("dependencies") or []),
        scheduled_date=(
            date.fromisoformat(row["scheduled_date"]) if row.get("scheduled_date") else None
        ),
        deadline=(date.fromisoformat(row["deadline"]) if row.get("deadline") else None),
    )


def _days_until_deadline(task_deadline: date | None) -> int | None:
    if task_deadline is None:
        return None
    return (task_deadline - date.today()).days


# ---------------------------------------------------------------------------
# JSON-adapter routes (Phase 0 — preserved for frontend compatibility)
# ---------------------------------------------------------------------------

_VALID_STATUSES_FULL = {"completed", "missed", "pending"}
_VALID_STATUSES_TERMINAL = {"completed", "missed"}


def _apply_task_status_to_state(state: dict[str, Any], task_id: str, status: str) -> dict[str, Any]:
    """Immutably update task status in the state dict."""
    tasks: list[dict[str, Any]] = state.get("tasks") or []
    updated = [{**t, "status": status} if t.get("id") == task_id else t for t in tasks]
    return {**state, "tasks": updated}


class TaskStatusUpdatePayload(BaseModel):
    id: str
    status: str


class TaskStatusPayload(BaseModel):
    taskId: str
    status: str


@router.post("/tasks")
async def update_task(payload: TaskStatusUpdatePayload) -> JSONResponse:
    if payload.status not in _VALID_STATUSES_FULL:
        raise HTTPException(
            status_code=400,
            detail={"error": "INVALID_TASK_STATUS", "message": "Invalid status."},
        )

    result = await safe_read_state()
    if not result["ok"]:
        raise HTTPException(status_code=500, detail={"error": result["errorCode"]})

    updated = _apply_task_status_to_state(result["state"], payload.id, payload.status)
    await write_state(updated)
    return JSONResponse({"status": "ok"})


@router.post("/task-status")
async def update_task_status_json(payload: TaskStatusPayload) -> JSONResponse:
    if payload.status not in _VALID_STATUSES_TERMINAL:
        raise HTTPException(
            status_code=400,
            detail={"error": "INVALID_TASK_STATUS", "message": "Invalid status."},
        )

    result = await safe_read_state()
    if not result["ok"]:
        raise HTTPException(status_code=500, detail={"error": result["errorCode"]})

    updated = _apply_task_status_to_state(result["state"], payload.taskId, payload.status)
    written = await write_state(updated)
    return JSONResponse({"state": written})


# ---------------------------------------------------------------------------
# Viability Pause — Supabase-backed (Phase 4)
# ---------------------------------------------------------------------------

_RESOLVE_TO_STATUS: dict[str, TaskStatus] = {
    "decompose": TaskStatus.DECOMPOSED,
    "extend": TaskStatus.DATE_EXTENDED,
    "archive": TaskStatus.ARCHIVED,
}

_URGENCY_MESSAGES = {
    "high": (
        "This task has been deferred multiple times or has an approaching deadline. "
        "Choose how to proceed: decompose it into smaller steps, extend its deadline, "
        "or archive it."
    ),
    "low": (
        "This task keeps getting pushed back with no deadline pressure. "
        "Consider whether it still belongs on your list."
    ),
}


class ViabilityResolvePayload(BaseModel):
    instance_id: str
    action: Literal["decompose", "extend", "archive"]


@router.get("/tasks/{task_id}/viability-pause")
async def check_viability_pause(
    task_id: str,
    instance_id: str,
    db: Annotated[AsyncClient, Depends(require_db_client)],
) -> dict[str, Any]:
    """Return viability pause status + resolution options for a task."""
    row = await tasks_repo.get_task(db, instance_id, task_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Task not found")

    task = _to_domain_task(row)
    days_left = _days_until_deadline(task.deadline)
    should_pause, urgency = should_trigger_viability_pause(task, days_left)

    prompt = None
    if should_pause and urgency:
        prompt = generate_viability_pause_prompt(urgency, task.title, task.deferral_count)

    return {
        "task_id": task_id,
        "should_pause": should_pause,
        "urgency": urgency,
        "deferral_count": task.deferral_count,
        "deadline_within_days": days_left,
        "prompt": prompt,
        "message": _URGENCY_MESSAGES.get(urgency or "", "") if should_pause else None,
        "options": ["decompose", "extend", "archive"] if should_pause else [],
    }


@router.post("/tasks/{task_id}/viability-pause/resolve")
async def resolve_viability_pause(
    task_id: str,
    payload: ViabilityResolvePayload,
    db: Annotated[AsyncClient, Depends(require_db_client)],
) -> dict[str, Any]:
    """Resolve a Viability Pause by transitioning the task to the chosen status."""
    row = await tasks_repo.get_task(db, payload.instance_id, task_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Task not found")

    task = _to_domain_task(row)
    to_status = _RESOLVE_TO_STATUS[payload.action]

    try:
        # ledger_writer is a no-op here; full audit trail wired in Phase 5.
        transition(task, to_status, ledger_writer=lambda _t, _s: None)
    except InvalidTransitionError as exc:
        raise HTTPException(
            status_code=422,
            detail=f"Cannot transition {exc.from_status} → {exc.to_status}",
        ) from exc

    updated = await tasks_repo.update_task_status(
        db,
        payload.instance_id,
        task_id,
        to_status.value,  # type: ignore[arg-type]
    )
    return {"task_id": task_id, "status": to_status.value, "task": updated}


# ---------------------------------------------------------------------------
# GET /tasks/{task_id}/decision-ledger
# ---------------------------------------------------------------------------


@router.get("/tasks/{task_id}/decision-ledger")
async def get_decision_ledger(
    task_id: str,
    instance_id: str,
    db: Annotated[AsyncClient, Depends(require_db_client)],
) -> list[dict[str, Any]]:
    """Return Decision Ledger entries for a task ('Why was this moved?')."""
    resp = await (
        db.table("decision_ledger")
        .select(
            "decision_type,from_date,to_date,reason_code,load_ratio_dest,algorithm_version,timestamp"
        )
        .eq("instance_id", instance_id)
        .eq("task_id", task_id)
        .order("timestamp", desc=True)
        .execute()
    )
    return resp.data or []
