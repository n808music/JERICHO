"""Integrity scoring engine — port of src/core/scoring-engine.js."""
from typing import Any

from jyriko.constants import DIFFICULTY_WEIGHTS, LATE_COMPLETION_PENALTY
from jyriko.domain.task_status import TASK_STATUS_COMPLETED, TASK_STATUS_MISSED, TASK_STATUS_PENDING


def compute_integrity_score(tasks: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    tasks = tasks or []
    completed = [t for t in tasks if t.get("status") == TASK_STATUS_COMPLETED]
    missed = [t for t in tasks if t.get("status") == TASK_STATUS_MISSED]
    pending = [t for t in tasks if t.get("status") == TASK_STATUS_PENDING]

    raw_total = 0.0
    max_possible = 0.0

    for task in tasks:
        impact = float(task.get("estimatedImpact") or 0)
        diff_w = DIFFICULTY_WEIGHTS.get(task.get("difficulty"), 1.0)
        if task.get("status") == TASK_STATUS_COMPLETED:
            time_w = LATE_COMPLETION_PENALTY if task.get("onTime") is False else 1.0
            raw_total += impact * diff_w * time_w
        elif task.get("status") == TASK_STATUS_MISSED:
            raw_total -= impact
        max_possible += impact * diff_w

    base = {
        "completedCount": len(completed),
        "missedCount": len(missed),
        "pendingCount": len(pending),
        "rawTotal": raw_total,
        "maxPossible": max_possible,
    }
    if max_possible <= 0:
        return {"score": 0, **base}
    clamped = max(0.0, min(1.0, raw_total / max_possible))
    return {"score": round(clamped * 100), **base}


def explain_integrity_score(tasks: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    tasks = tasks or []
    summary = compute_integrity_score(tasks)
    completed_on_time = sum(
        1 for t in tasks if t.get("status") == TASK_STATUS_COMPLETED and t.get("onTime") is True
    )
    completed_late = sum(
        1 for t in tasks if t.get("status") == TASK_STATUS_COMPLETED and t.get("onTime") is False
    )
    missed_count = sum(1 for t in tasks if t.get("status") == TASK_STATUS_MISSED)
    total = len(tasks)
    completion_rate = summary["completedCount"] / total if total else 0.0
    on_time_rate = completed_on_time / summary["completedCount"] if summary["completedCount"] else 0.0
    return {
        "score": summary["score"],
        "breakdown": {
            "completedOnTime": completed_on_time,
            "completedLate": completed_late,
            "missed": missed_count,
            "totalTasks": total,
            "completionRate": completion_rate,
            "onTimeRate": on_time_rate,
        },
    }
