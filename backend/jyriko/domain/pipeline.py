"""
Closed-loop pipeline orchestrator — port of src/core/pipeline.js.
Output shape must match the JS version exactly; the React frontend consumes it unchanged.
"""
from datetime import datetime, timedelta, timezone
from typing import Any

from jyriko.domain.behavioral_control_engine import select_pacing_mode
from jyriko.domain.gap_analysis import compute_capability_gaps, rank_capability_gaps
from jyriko.domain.goal_domain import normalize_goal_input
from jyriko.domain.identity_requirements import derive_identity_requirements
from jyriko.domain.identity_update import apply_identity_update
from jyriko.domain.scoring_engine import compute_integrity_score, explain_integrity_score
from jyriko.domain.task_generator import generate_tasks_for_cycle
from jyriko.domain.task_status import TASK_STATUS_PENDING
from jyriko.domain.temporal_engine import build_day_slots, schedule_tasks_into_slots
from jyriko.domain.validate_goal import validate_goal


def _normalize_identity(identity: Any) -> list[dict[str, Any]]:
    """Convert identity dict {domain: {cap: {level: N}}} → flat list."""
    if isinstance(identity, list):
        return identity
    if not isinstance(identity, dict):
        return []
    entries: list[dict[str, Any]] = []
    for domain, caps in identity.items():
        if not isinstance(caps, dict):
            continue
        for capability, data in caps.items():
            level = data.get("level", 0) if isinstance(data, dict) else float(data or 0)
            entries.append({"domain": domain, "capability": capability, "level": float(level)})
    return entries


def _empty_integrity() -> dict[str, Any]:
    return {
        "score": 0,
        "completedCount": 0,
        "missedCount": 0,
        "pendingCount": 0,
        "rawTotal": 0,
        "maxPossible": 0,
        "breakdown": {
            "completedOnTime": 0, "completedLate": 0, "missed": 0,
            "totalTasks": 0, "completionRate": 0, "onTimeRate": 0,
        },
        "lastRun": None,
    }


def _build_fallback_task(goal: dict[str, Any], goal_meta: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": "task-fallback-0",
        "title": f"Start working toward: {goal.get('outcome', 'your goal')}",
        "description": f"First step for: {goal.get('raw', '')}",
        "domain": goal_meta.get("domain", "Execution"),
        "capability": goal_meta.get("capability", "discipline"),
        "tier": "T1",
        "effortMinutes": 60,
        "difficulty": 1,
        "estimatedImpact": 0.5,
        "status": TASK_STATUS_PENDING,
        "goalLink": goal.get("raw") or goal.get("outcome") or "goal",
    }


def run_pipeline(
    goal_input: dict[str, Any],
    identity: Any,
    history: list[dict[str, Any]] | None = None,
    tasks: list[dict[str, Any]] | None = None,
    team: Any = None,
) -> dict[str, Any]:
    """Pure function — no I/O. All external state passed as arguments."""
    history = history or []
    tasks = tasks or []

    goals_list = goal_input.get("goals") if isinstance(goal_input.get("goals"), list) else []
    raw_goal = goals_list[0] if goals_list else ""
    validation = validate_goal(raw_goal)
    identity_state = _normalize_identity(identity)

    if not validation["valid"]:
        return {
            "goal": None,
            "error": validation.get("error"),
            "identityBefore": identity_state,
            "identityAfter": identity_state,
            "requirements": [],
            "gaps": [],
            "rankedGaps": [],
            "tasks": [],
            "integrity": _empty_integrity(),
            "changes": [],
            "history": history,
        }

    goal = validation["goal"]
    requirements = derive_identity_requirements(goal)
    gaps_before = compute_capability_gaps(identity_state, requirements)
    ranked_gaps_before = rank_capability_gaps(gaps_before)
    goal_meta = normalize_goal_input(goal.get("raw"))

    integrity_summary = compute_integrity_score(tasks)
    integrity_explanation = explain_integrity_score(tasks)

    update_result = apply_identity_update(identity_state, ranked_gaps_before, integrity_summary, tasks)
    updated_identity = update_result["updatedIdentity"]
    changes = update_result["changes"]

    gaps_after = compute_capability_gaps(updated_identity, requirements)
    ranked_gaps_after = rank_capability_gaps(gaps_after)

    average_pressure = (
        sum(max(0, g.get("weightedGap") or 0) for g in ranked_gaps_after) / len(ranked_gaps_after)
        if ranked_gaps_after else 0.0
    )
    total_terminal = integrity_summary["completedCount"] + integrity_summary["missedCount"]
    recent_completion_rate = (
        integrity_summary["completedCount"] / total_terminal if total_terminal > 0 else 0.0
    )
    pacing = select_pacing_mode(
        integrity=integrity_summary["score"],
        average_pressure=average_pressure,
        recent_completion_rate=recent_completion_rate,
    )

    with_fallback_gaps = ranked_gaps_after or [
        {
            "requirementId": goal_meta.get("domain"),
            "domain": goal_meta.get("domain"),
            "capability": goal_meta.get("capability"),
            "targetLevel": 5,
            "currentLevel": 0,
            "weight": 0.5,
            "weightedGap": 1,
        }
    ]

    next_cycle_tasks = generate_tasks_for_cycle(
        goal,
        with_fallback_gaps,
        {
            "maxTasks": 4 + (pacing.get("maxTasksDelta") or 0),
            "cycleDays": 7,
            "domainHint": goal_meta.get("domain"),
            "capabilityHint": goal_meta.get("capability"),
            "integrityScore": integrity_summary["score"],
            "goalLink": goal.get("raw") or goal.get("outcome") or "goal",
            "difficultyBias": pacing.get("difficultyBias") or 0,
        },
    )
    for idx, task in enumerate(next_cycle_tasks):
        cap = with_fallback_gaps[idx]["capability"] if idx < len(with_fallback_gaps) else task.get("capability", "cap")
        task["id"] = f"task-{cap}-{idx}"

    if not next_cycle_tasks:
        next_cycle_tasks.append(_build_fallback_task(goal, goal_meta))

    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()
    cycle_end_iso = (now + timedelta(days=7)).isoformat()

    day_slots = build_day_slots(now_iso, cycle_end_iso)
    schedule_result = schedule_tasks_into_slots(next_cycle_tasks, day_slots, integrity_summary)

    history_entry: dict[str, Any] = {
        "timestamp": now_iso,
        "cycleStart": now_iso,
        "cycleEnd": cycle_end_iso,
        "goal": goal.get("raw"),
        "integrity": {"score": integrity_summary["score"], "breakdown": integrity_explanation.get("breakdown", {})},
        "changes": changes,
        "taskCount": len(next_cycle_tasks),
    }

    return {
        "goal": goal,
        "identityBefore": identity_state,
        "identityAfter": updated_identity,
        "requirements": requirements,
        "gaps": gaps_after,
        "rankedGaps": ranked_gaps_after,
        "tasks": next_cycle_tasks,
        "daySlots": schedule_result["daySlots"],
        "overflowTasks": schedule_result["overflowTasks"],
        "todayPriorityTaskId": schedule_result["todayPriorityTaskId"],
        "pacing": pacing,
        "integrity": {
            **integrity_summary,
            "breakdown": integrity_explanation.get("breakdown", {}),
            "lastRun": now_iso,
        },
        "changes": changes,
        "history": [*history, history_entry],
        "analysis": {
            "averagePressure": average_pressure,
            "recentCompletionRate": recent_completion_rate,
        },
        "team": team,
    }
