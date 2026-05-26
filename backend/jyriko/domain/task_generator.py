"""
Port of src/core/task-generator.js — LADDERS template system.
Phase 1: replaced by LLM decomposition pipeline. Kept as fallback.
"""
import uuid
from typing import Any

# Minimal LADDERS subset (execution domain only — full LADDERS omitted for brevity;
# Phase 1 LLM replaces this entirely).
_LADDERS: dict[str, dict[str, dict[str, list[dict[str, Any]]]]] = {
    "execution": {
        "execution": {
            "T1": [
                {"title": "Define a single offer", "effortMinutes": 45, "difficulty": 2, "estimatedImpact": 0.6},
                {"title": "Identify top 3 customer segments", "effortMinutes": 45, "difficulty": 1, "estimatedImpact": 0.6},
                {"title": "Block 90 minutes for outreach/creation", "effortMinutes": 90, "difficulty": 2, "estimatedImpact": 0.7},
            ],
            "T2": [
                {"title": "Ship one revenue asset", "effortMinutes": 90, "difficulty": 3, "estimatedImpact": 0.8},
                {"title": "Execute 20 minutes of direct outreach", "effortMinutes": 30, "difficulty": 2, "estimatedImpact": 0.7},
                {"title": "Write 3 lessons from yesterday", "effortMinutes": 20, "difficulty": 1, "estimatedImpact": 0.5},
            ],
            "T3": [
                {"title": "Weekly pipeline review", "effortMinutes": 45, "difficulty": 2, "estimatedImpact": 0.6},
                {"title": "Design a conversion experiment", "effortMinutes": 60, "difficulty": 3, "estimatedImpact": 0.7},
            ],
        }
    },
}

_DEFAULT_TASKS: list[dict[str, Any]] = [
    {"title": "Set a daily start time", "effortMinutes": 30, "difficulty": 1, "estimatedImpact": 0.5},
    {"title": "Ship daily output", "effortMinutes": 60, "difficulty": 2, "estimatedImpact": 0.7},
    {"title": "Honor a fixed block", "effortMinutes": 90, "difficulty": 2, "estimatedImpact": 0.6},
    {"title": "Time-block your week", "effortMinutes": 45, "difficulty": 1, "estimatedImpact": 0.5},
]


def _select_tier(integrity_score: float, difficulty_bias: float) -> str:
    adjusted = integrity_score + (difficulty_bias * 20)
    if adjusted < 40:
        return "T1"
    if adjusted < 70:
        return "T2"
    return "T3"


def generate_tasks_for_cycle(
    goal: dict[str, Any],
    ranked_gaps: list[dict[str, Any]] | None = None,
    options: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    """
    LADDERS-based fallback task generation.
    Phase 1 replaces this with LLM decomposition.
    """
    opts = options or {}
    max_tasks: int = opts.get("maxTasks", 4)
    integrity_score: float = float(opts.get("integrityScore", 50))
    difficulty_bias: float = float(opts.get("difficultyBias", 0))
    goal_link: str = opts.get("goalLink") or (goal.get("raw") or goal.get("outcome") or "goal")
    domain_hint: str = (opts.get("domainHint") or "execution").lower()
    capability_hint: str = (opts.get("capabilityHint") or "execution").lower()

    tier = _select_tier(integrity_score, difficulty_bias)

    ladder = (
        _LADDERS.get(domain_hint, {}).get(capability_hint, {}).get(tier)
        or _LADDERS.get("execution", {}).get("execution", {}).get(tier)
        or _DEFAULT_TASKS
    )

    tasks: list[dict[str, Any]] = []
    for i, template in enumerate(ladder[:max_tasks]):
        gap = ranked_gaps[i] if ranked_gaps and i < len(ranked_gaps) else {}
        tasks.append({
            "title": template["title"],
            "description": f"Toward goal: {goal_link}",
            "domain": gap.get("domain") or domain_hint,
            "capability": gap.get("capability") or capability_hint,
            "tier": tier,
            "effortMinutes": template.get("effortMinutes", 60),
            "difficulty": template.get("difficulty", 2),
            "estimatedImpact": template.get("estimatedImpact", 0.6),
            "status": "pending",
            "goalLink": goal_link,
        })

    return tasks
