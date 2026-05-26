"""Port of src/core/identity-update.js."""
from typing import Any

_MAX_STEP = 2.0


def _key(domain: Any, capability: Any) -> str:
    return f"{domain or ''}:{capability or ''}".lower()


def _clamp(val: Any, lo: float, hi: float) -> float:
    try:
        n = float(val)
    except (TypeError, ValueError):
        return lo
    return min(max(n, lo), hi)


def apply_identity_update(
    identity_state: list[dict[str, Any]] | None = None,
    ranked_gaps: list[dict[str, Any]] | None = None,
    integrity_summary: dict[str, Any] | None = None,
    tasks: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    identity_state = identity_state or []
    ranked_gaps = ranked_gaps or []
    tasks = tasks or []

    integrity_factor = (
        (integrity_summary.get("score") or 0) / 100
        if integrity_summary and (integrity_summary.get("maxPossible") or 0) > 0
        else 0.0
    )

    gap_map: dict[str, dict[str, Any]] = {
        _key(g.get("domain"), g.get("capability")): g for g in ranked_gaps
    }

    activity_map: dict[str, float] = {}
    for task in tasks:
        k = _key(task.get("domain"), task.get("capability"))
        impact = float(task.get("estimatedImpact") or 0)
        activity_map[k] = activity_map.get(k, 0.0) + impact

    max_impact = max(activity_map.values(), default=0.0)

    updated_identity: list[dict[str, Any]] = []
    changes: list[dict[str, Any]] = []

    for entry in identity_state:
        k = _key(entry.get("domain"), entry.get("capability"))
        total_impact = activity_map.get(k, 0.0)
        gap = gap_map.get(k)

        if not gap or total_impact <= 0 or (gap.get("rawGap") or 0) <= 0:
            updated_identity.append(dict(entry))
            continue

        activity_factor = total_impact / max_impact if max_impact > 0 else 0.0
        combined_factor = integrity_factor * activity_factor
        desired_step = min(gap.get("rawGap") or 0, _MAX_STEP) * combined_factor
        step = round(desired_step * 10) / 10

        if step <= 0:
            updated_identity.append(dict(entry))
            continue

        new_level = (entry.get("level") or 0) + step
        new_level = min(new_level, gap.get("targetLevel") or 10)
        new_level = _clamp(new_level, 1, 10)

        updated_entry = {**entry, "level": new_level}
        updated_identity.append(updated_entry)
        changes.append({
            "id": entry.get("id"),
            "domain": entry.get("domain"),
            "capability": entry.get("capability"),
            "beforeLevel": entry.get("level"),
            "afterLevel": new_level,
            "delta": new_level - (entry.get("level") or 0),
        })

    return {"updatedIdentity": updated_identity, "changes": changes}
