"""Port of src/core/task-status.js."""
from datetime import datetime, timezone
from typing import Any

TASK_STATUS_PENDING = "pending"
TASK_STATUS_COMPLETED = "completed"
TASK_STATUS_MISSED = "missed"


def _to_iso(value: Any) -> str:
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)


def complete_task(task: dict[str, Any], now: datetime | str, deadline_override: str | None = None) -> dict[str, Any]:
    completed_at = _to_iso(now)
    effective_deadline = deadline_override or task.get("dueDate")
    on_time = (completed_at <= effective_deadline) if effective_deadline else True
    return {**task, "status": TASK_STATUS_COMPLETED, "completedAt": completed_at, "onTime": on_time}


def miss_task(task: dict[str, Any], now: datetime | str) -> dict[str, Any]:
    missed_at = _to_iso(now)
    return {**task, "status": TASK_STATUS_MISSED, "completedAt": None, "onTime": False, "missedAt": missed_at}


def is_task_overdue(task: dict[str, Any], now: datetime | str) -> bool:
    if not task or task.get("status") != TASK_STATUS_PENDING:
        return False
    due_date = task.get("dueDate")
    if not due_date:
        return False
    return _to_iso(now) > due_date


def summarize_task_set(tasks: list[dict[str, Any]] | None = None) -> dict[str, int]:
    tasks = tasks or []
    completed = sum(1 for t in tasks if t.get("status") == TASK_STATUS_COMPLETED)
    missed = sum(1 for t in tasks if t.get("status") == TASK_STATUS_MISSED)
    pending = sum(1 for t in tasks if t.get("status") == TASK_STATUS_PENDING)
    return {"total": len(tasks), "completed": completed, "missed": missed, "pending": pending}
