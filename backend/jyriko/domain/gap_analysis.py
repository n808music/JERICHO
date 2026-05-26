"""Capability gap analysis — port of src/core/gap-analysis.js."""
from typing import Any


def _key(domain: Any, capability: Any) -> str:
    return f"{domain or ''}:{capability or ''}".lower()


def _clamp(val: Any, lo: float, hi: float) -> float:
    try:
        return min(max(float(val), lo), hi)
    except (TypeError, ValueError):
        return lo


def calculate_gap(requirements: list[dict[str, Any]] | None = None) -> list[dict[str, Any]]:
    requirements = requirements or []
    gaps = [
        {
            "domain": req.get("domain"),
            "capability": req.get("capability"),
            "targetLevel": req.get("targetLevel"),
            "currentLevel": req.get("currentLevel") or 0,
            "gap": max((req.get("targetLevel") or 0) - (req.get("currentLevel") or 0), 0),
            "rationale": req.get("rationale"),
        }
        for req in requirements
    ]
    return sorted(gaps, key=lambda g: (-g["gap"], -(g.get("targetLevel") or 0)))


def compute_capability_gaps(
    identity_state: list[dict[str, Any]] | None = None,
    requirements: list[dict[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    identity_state = identity_state or []
    requirements = requirements or []
    state_index: dict[str, dict[str, Any]] = {
        _key(e.get("domain"), e.get("capability")): {**e, "level": _clamp(e.get("level"), 1, 10)}
        for e in identity_state
    }

    def _current(req: dict[str, Any]) -> float:
        k = _key(req.get("domain"), req.get("capability"))
        return state_index[k]["level"] if k in state_index else 3.0

    return [
        {
            "requirementId": req.get("id"),
            "domain": req.get("domain"),
            "capability": req.get("capability"),
            "targetLevel": req.get("targetLevel"),
            "currentLevel": _current(req),
            "weight": _clamp(req.get("weight") or 0, 0, 1),
            "rawGap": max((req.get("targetLevel") or 0) - _current(req), 0),
            "weightedGap": _clamp(req.get("weight") or 0, 0, 1) * max(
                (req.get("targetLevel") or 0) - _current(req), 0
            ),
        }
        for req in requirements
    ]


def rank_capability_gaps(gaps: list[dict[str, Any]] | None = None) -> list[dict[str, Any]]:
    gaps = gaps or []
    ranked = sorted(gaps, key=lambda g: (-(g.get("weightedGap") or 0), str(g.get("capability") or "")))
    return [{**g, "rank": idx + 1} for idx, g in enumerate(ranked)]
