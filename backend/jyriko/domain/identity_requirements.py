"""Port of src/core/identity-requirements.js."""
import uuid
from typing import Any

_CATEGORY_REQUIREMENTS: dict[str, list[dict[str, Any]]] = {
    "creative_project": [
        {"domain": "Execution", "capability": "discipline", "targetLevel": 8, "weight": 0.25},
        {"domain": "Execution", "capability": "consistency", "targetLevel": 9, "weight": 0.25},
        {"domain": "Output", "capability": "daily_output", "targetLevel": 8, "weight": 0.2},
        {"domain": "Planning", "capability": "roadmapping", "targetLevel": 7, "weight": 0.15},
        {"domain": "Planning", "capability": "time_blocking", "targetLevel": 7, "weight": 0.15},
    ],
    "product_launch": [
        {"domain": "Execution", "capability": "discipline", "targetLevel": 8, "weight": 0.2},
        {"domain": "Execution", "capability": "follow_through", "targetLevel": 9, "weight": 0.2},
        {"domain": "Output", "capability": "shipping_frequency", "targetLevel": 8, "weight": 0.2},
        {"domain": "Planning", "capability": "roadmapping", "targetLevel": 8, "weight": 0.2},
        {"domain": "Planning", "capability": "time_blocking", "targetLevel": 7, "weight": 0.2},
    ],
    "body_composition": [
        {"domain": "Execution", "capability": "consistency", "targetLevel": 9, "weight": 0.3},
        {"domain": "Health", "capability": "energy_management", "targetLevel": 8, "weight": 0.25},
        {"domain": "Health", "capability": "sleep_hygiene", "targetLevel": 7, "weight": 0.2},
        {"domain": "Output", "capability": "daily_output", "targetLevel": 6, "weight": 0.25},
    ],
    "learning_goal": [
        {"domain": "Execution", "capability": "deep_work", "targetLevel": 8, "weight": 0.3},
        {"domain": "Execution", "capability": "consistency", "targetLevel": 8, "weight": 0.25},
        {"domain": "Learning", "capability": "study_hours", "targetLevel": 9, "weight": 0.25},
        {"domain": "Planning", "capability": "time_blocking", "targetLevel": 7, "weight": 0.2},
    ],
    "generic_execution": [
        {"domain": "Execution", "capability": "discipline", "targetLevel": 7, "weight": 0.3},
        {"domain": "Execution", "capability": "consistency", "targetLevel": 7, "weight": 0.3},
        {"domain": "Planning", "capability": "time_blocking", "targetLevel": 6, "weight": 0.2},
        {"domain": "Output", "capability": "daily_output", "targetLevel": 6, "weight": 0.2},
    ],
}

_RATIONALE: dict[str, str] = {
    "creative_project": "Required to ship creative work on schedule.",
    "product_launch": "Required to launch reliably and hit release targets.",
    "body_composition": "Required to maintain health and composition targets.",
    "learning_goal": "Required to progress through learning milestones.",
    "generic_execution": "Required to sustain consistent execution.",
}


def _clamp(val: float, lo: float, hi: float) -> float:
    return min(max(float(val), lo), hi)


def _includes_any(text: str, words: list[str]) -> bool:
    return any(w in text for w in words)


def classify_goal_category(goal: dict[str, Any]) -> str:
    outcome = (goal.get("outcome") or goal.get("raw") or "").lower()
    if _includes_any(outcome, ["album", "song", "mixtape", "book", "script", "video", "podcast", "content"]):
        return "creative_project"
    if _includes_any(outcome, ["app", "product", "platform", "feature", "startup", "launch"]):
        return "product_launch"
    if _includes_any(outcome, ["pounds", "lb", "kg", "weight", "body fat", "fat", "muscle"]):
        return "body_composition"
    if _includes_any(outcome, ["exam", "test", "bar", "license", "certification", "degree", "course"]):
        return "learning_goal"
    return "generic_execution"


def derive_identity_requirements(goal: dict[str, Any]) -> list[dict[str, Any]]:
    category = classify_goal_category(goal)
    base = _CATEGORY_REQUIREMENTS.get(category, _CATEGORY_REQUIREMENTS["generic_execution"])
    rationale_prefix = _RATIONALE.get(category, _RATIONALE["generic_execution"])
    return [
        {
            "id": str(uuid.uuid4()),
            "domain": item["domain"],
            "capability": item["capability"],
            "targetLevel": _clamp(item["targetLevel"], 1, 10),
            "weight": _clamp(item["weight"], 0, 1),
            "rationale": f"{rationale_prefix} Focus: {item['capability']}.",
        }
        for item in base
    ]
