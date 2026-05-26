"""Port of src/core/temporal-engine.js — day slot scheduling."""
from datetime import datetime, timedelta, timezone
from typing import Any


def build_day_slots(cycle_start_iso: str, cycle_end_iso: str) -> list[dict[str, Any]]:
    """Build a list of day slot dicts between two ISO timestamps."""
    start = datetime.fromisoformat(cycle_start_iso.rstrip("Z")).replace(tzinfo=timezone.utc)
    end = datetime.fromisoformat(cycle_end_iso.rstrip("Z")).replace(tzinfo=timezone.utc)
    slots: list[dict[str, Any]] = []
    current = start
    while current < end:
        slots.append({
            "date": current.date().isoformat(),
            "iso": current.isoformat(),
            "tasks": [],
            "load": 0.0,
        })
        current += timedelta(days=1)
    return slots


def schedule_tasks_into_slots(
    tasks: list[dict[str, Any]],
    day_slots: list[dict[str, Any]],
    integrity_summary: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Greedy slot assignment — one task per slot up to max_per_day.
    Phase 4 replaces this with the full look-ahead feathering engine.
    """
    integrity_summary = integrity_summary or {}
    max_per_day = 2 if (integrity_summary.get("score") or 0) < 40 else 3

    scheduled = [dict(slot) for slot in day_slots]
    overflow: list[dict[str, Any]] = []
    today_priority_task_id: str | None = None

    task_idx = 0
    for slot in scheduled:
        slot_tasks = 0
        while task_idx < len(tasks) and slot_tasks < max_per_day:
            task = tasks[task_idx]
            slot["tasks"].append(task["id"] if "id" in task else task.get("title", ""))
            slot["load"] = round(slot["load"] + float(task.get("effortMinutes", 60)) / 480, 2)
            if today_priority_task_id is None:
                today_priority_task_id = task.get("id") or task.get("title")
            task_idx += 1
            slot_tasks += 1

    overflow = tasks[task_idx:]

    return {
        "daySlots": scheduled,
        "overflowTasks": overflow,
        "todayPriorityTaskId": today_priority_task_id,
    }
