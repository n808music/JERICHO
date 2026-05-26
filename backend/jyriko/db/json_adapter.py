"""
Phase 0 JSON file storage adapter.
Direct port of src/data/storage.js — same function names, same state shape.
Replaced by Supabase repositories in Phase 2.
"""
import json
from pathlib import Path
from typing import Any

from jyriko.config import get_settings

_StateDict = dict[str, Any]


def _get_store_path() -> Path:
    return get_settings().state_path


def _default_integrity() -> dict[str, Any]:
    return {"score": 0, "completedCount": 0, "pendingCount": 0, "lastRun": None}


def _normalize_integrity(raw: Any) -> dict[str, Any]:
    if not isinstance(raw, dict):
        return _default_integrity()
    return {
        "score": float(raw.get("score") or 0),
        "completedCount": int(raw.get("completedCount") or 0),
        "pendingCount": int(raw.get("pendingCount") or 0),
        "lastRun": raw.get("lastRun"),
    }


def _build_state(raw: Any) -> _StateDict:
    base = raw if isinstance(raw, dict) else {}
    return {
        "goals": base.get("goals") if isinstance(base.get("goals"), list) else [],
        "identity": base.get("identity") if isinstance(base.get("identity"), dict) else {},
        "history": base.get("history") if isinstance(base.get("history"), list) else [],
        "tasks": base.get("tasks") if isinstance(base.get("tasks"), list) else [],
        "integrity": _normalize_integrity(base.get("integrity")),
        "team": base.get("team") if base.get("team") is not None else {},
    }


async def read_state() -> _StateDict:
    path = _get_store_path()
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
        return _build_state(raw)
    except FileNotFoundError:
        default = _build_state({})
        await write_state(default)
        return default


async def safe_read_state(validate: bool = False) -> dict[str, Any]:
    """Returns {ok: bool, state?: dict, errorCode?: str, reason?: str}."""
    path = _get_store_path()
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
        state = _build_state(raw)
        return {"ok": True, "state": state}
    except FileNotFoundError:
        default = _build_state({})
        await write_state(default)
        return {"ok": True, "state": default}
    except json.JSONDecodeError:
        return {"ok": False, "errorCode": "BAD_STATE", "reason": "State file is not valid JSON."}
    except Exception as exc:
        return {"ok": False, "errorCode": "BAD_STATE", "reason": str(exc)}


async def write_state(state: _StateDict) -> _StateDict:
    next_state = _build_state(state)
    path = _get_store_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(next_state, indent=2), encoding="utf-8")
    return next_state


async def append_goal(goal: str) -> _StateDict:
    current = await read_state()
    goals = [*(current.get("goals") or []), goal]
    return await write_state({**current, "goals": goals})


async def update_identity(domain: str, capability: str, level: float) -> _StateDict:
    current = await read_state()
    identity: dict[str, Any] = dict(current.get("identity") or {})
    identity[domain] = dict(identity.get(domain) or {})
    identity[domain][capability] = {"level": level}
    return await write_state({**current, "identity": identity})


async def record_task_status(
    task_id: str,
    status: str,
    meta: dict[str, Any] | None = None,
) -> _StateDict:
    from datetime import datetime, timezone

    meta = meta or {}
    current = await read_state()
    now_iso = datetime.now(timezone.utc).isoformat()
    history_entry = {
        "id": task_id,
        "taskId": task_id,
        "domain": meta.get("domain", "unknown"),
        "capability": meta.get("capability", "unknown"),
        "tier": meta.get("tier", "foundation"),
        "effortMinutes": meta.get("effortMinutes", 60),
        "goalLink": meta.get("goalLink", "goal"),
        "status": status,
        "timestamp": now_iso,
        "integrity": {
            "scoreDelta": 0,
            "breakdown": {
                **(meta.get("integrityBreakdown") or {}),
                "completedOnTime": 1 if status == "completed" else 0,
                "completedLate": 0,
                "missed": 1 if status == "missed" else 0,
                "totalTasks": 1,
                "completionRate": 1.0 if status == "completed" else 0.0,
                "onTimeRate": 1.0 if status == "completed" else 0.0,
            },
        },
    }
    history = [*(current.get("history") or []), history_entry]
    existing_tasks: list[dict[str, Any]] = current.get("tasks") or []
    updated_tasks = [
        {**t, "status": status} if t.get("id") == task_id else t
        for t in existing_tasks
    ]
    if not any(t.get("id") == task_id for t in existing_tasks):
        updated_tasks.append({
            "id": task_id,
            "status": status,
            "domain": meta.get("domain"),
            "capability": meta.get("capability"),
            "tier": meta.get("tier"),
            "effortMinutes": meta.get("effortMinutes"),
            "goalLink": meta.get("goalLink"),
        })
    return await write_state({**current, "history": history, "tasks": updated_tasks})
