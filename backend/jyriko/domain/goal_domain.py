"""Port of src/core/goal-domain.js — normalizeGoalInput."""
from typing import Any


def normalize_goal_input(raw: str | None) -> dict[str, Any]:
    """Classify a raw goal string into domain/capability hints."""
    text = (raw or "").lower()

    if any(w in text for w in ["album", "song", "podcast", "content", "book", "script"]):
        return {"domain": "Output", "capability": "daily_output"}
    if any(w in text for w in ["app", "product", "launch", "startup", "feature"]):
        return {"domain": "Execution", "capability": "follow_through"}
    if any(w in text for w in ["weight", "body", "muscle", "health", "fat"]):
        return {"domain": "Health", "capability": "consistency"}
    if any(w in text for w in ["exam", "degree", "certification", "learn", "study"]):
        return {"domain": "Learning", "capability": "study_hours"}

    return {"domain": "Execution", "capability": "discipline"}
