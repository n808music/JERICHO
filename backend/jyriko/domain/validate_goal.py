"""Goal validation — port of src/core/validate-goal.js."""
import re
import uuid
from typing import Any

_BINARY_VERBS = ["finish", "complete", "release", "launch", "pass", "submit", "deliver"]
_REPEATED_PATTERN = re.compile(
    r"(per\s+(day|week|month|hour))|daily|weekly|monthly|every\s+\w+", re.IGNORECASE
)
_DEADLINE_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}(T.*)?$")
_NUMBER_PATTERN = re.compile(r"(\d+(\.\d+)?)")


def validate_goal(raw_goal_input: Any) -> dict[str, Any]:
    if not isinstance(raw_goal_input, str):
        return {"valid": False, "error": "invalid_outcome"}

    parts = re.split(r"\sby\s", raw_goal_input, flags=re.IGNORECASE)
    if len(parts) != 2:
        return {"valid": False, "error": "missing_by_keyword"}

    outcome_raw, deadline_raw = parts[0].strip(), parts[1].strip()
    outcome_check = _validate_outcome(outcome_raw)
    if not outcome_check["valid"]:
        return outcome_check

    deadline_check = _validate_deadline(deadline_raw)
    if not deadline_check["valid"]:
        return deadline_check

    metric = outcome_check["metric"]
    return {
        "valid": True,
        "goal": {
            "id": str(uuid.uuid4()),
            "raw": raw_goal_input,
            "outcome": outcome_check["outcome"],
            "metric": metric,
            "deadline": deadline_check["deadline"],
            "type": _classify_type(outcome_raw, metric),
        },
    }


def _validate_outcome(outcome_raw: str) -> dict[str, Any]:
    lower = outcome_raw.lower()
    if not lower.startswith("i will"):
        return {"valid": False, "error": "invalid_outcome"}
    if re.search(r"\band\b", outcome_raw, re.IGNORECASE):
        return {"valid": False, "error": "compound_goal"}

    number_match = _NUMBER_PATTERN.search(outcome_raw)
    verb_match = next(
        (v for v in _BINARY_VERBS if re.search(rf"\b{v}\b", outcome_raw, re.IGNORECASE)), None
    )
    if not number_match and not verb_match:
        if re.search(r"(improve|better|more|some|try)", outcome_raw, re.IGNORECASE):
            return {"valid": False, "error": "vague_outcome"}
        return {"valid": False, "error": "missing_metrics"}

    metric = number_match.group(1) if number_match else verb_match
    return {"valid": True, "outcome": outcome_raw, "metric": metric}


def _validate_deadline(deadline_raw: str) -> dict[str, Any]:
    if not _DEADLINE_PATTERN.match(deadline_raw):
        return {"valid": False, "error": "ambiguous_deadline"}
    from datetime import datetime
    try:
        dt = datetime.fromisoformat(deadline_raw.rstrip("Z"))
        return {"valid": True, "deadline": dt.isoformat()}
    except ValueError:
        return {"valid": False, "error": "invalid_deadline"}


def _classify_type(outcome_raw: str, metric: str | None) -> str:
    if _REPEATED_PATTERN.search(outcome_raw):
        return "production"
    if metric and re.match(r"^\d+(\.\d+)?$", metric):
        return "production"
    return "event"
