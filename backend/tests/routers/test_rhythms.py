"""
TDD: tests for routers/rhythms.py.
Uses FastAPI dependency_overrides + MagicMock-chain pattern.
"""
from __future__ import annotations

from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from jyriko.db.deps import require_db_client
from jyriko.main import create_app

_INSTANCE = "cccccccc-cccc-cccc-cccc-cccccccccccc"

_UNSET = object()


def _mock_db(data=_UNSET) -> MagicMock:
    db = MagicMock()
    db.table.return_value = db
    db.select.return_value = db
    db.eq.return_value = db
    db.order.return_value = db
    db.maybe_single.return_value = db
    db.insert.return_value = db
    db.upsert.return_value = db

    _data = [] if data is _UNSET else data

    async def _execute() -> MagicMock:
        return MagicMock(data=_data)

    db.execute = _execute
    return db


def _mock_db_sequence(*responses) -> MagicMock:
    db = MagicMock()
    db.table.return_value = db
    db.select.return_value = db
    db.eq.return_value = db
    db.order.return_value = db
    db.maybe_single.return_value = db
    db.insert.return_value = db
    db.upsert.return_value = db

    idx = [0]

    async def _execute() -> MagicMock:
        val = responses[idx[0]] if idx[0] < len(responses) else []
        idx[0] += 1
        return MagicMock(data=val)

    db.execute = _execute
    return db


def _client(db: MagicMock) -> TestClient:
    app = create_app()
    app.dependency_overrides[require_db_client] = lambda: db
    return TestClient(app)


_IDENTITY_ROWS = [
    {"day_of_week": i, "declared_capacity": 0.8, "derived_capacity": 0.75, "week_number": 4}
    for i in range(7)
]

_TASKS = [
    {"id": "t1", "title": "Task A", "status": "scheduled", "cognitive_load": 0.3,
     "scheduled_date": "2026-04-07", "goal_id": "g1"},
]


# ---------------------------------------------------------------------------
# GET /rhythms/sunday-briefing
# ---------------------------------------------------------------------------

def test_sunday_briefing_returns_capacity_snapshot() -> None:
    db = _mock_db_sequence(_IDENTITY_ROWS, _TASKS)
    resp = _client(db).get("/rhythms/sunday-briefing", params={"instance_id": _INSTANCE})
    assert resp.status_code == 200
    body = resp.json()
    assert "capacity_snapshot" in body
    assert "tasks" in body


def test_sunday_briefing_capacity_snapshot_is_mandatory() -> None:
    """capacity_snapshot must always be present, even with no data."""
    db = _mock_db_sequence([], [])
    resp = _client(db).get("/rhythms/sunday-briefing", params={"instance_id": _INSTANCE})
    assert resp.status_code == 200
    assert "capacity_snapshot" in resp.json()


# ---------------------------------------------------------------------------
# GET /rhythms/saturday-sundown/preview
# ---------------------------------------------------------------------------

def test_sundown_preview_returns_completion_ratio() -> None:
    tasks = [
        {"id": "t1", "status": "completed"},
        {"id": "t2", "status": "completed"},
        {"id": "t3", "status": "missed"},
        {"id": "t4", "status": "missed"},
    ]
    db = _mock_db(tasks)
    resp = _client(db).get(
        "/rhythms/saturday-sundown/preview",
        params={"instance_id": _INSTANCE},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "completion_ratio" in body
    assert body["completion_ratio"] == pytest.approx(0.5)


def test_sundown_preview_includes_deferred_tasks() -> None:
    tasks = [
        {"id": "t1", "status": "completed"},
        {"id": "t2", "status": "rescheduled", "title": "Deferred task"},
    ]
    db = _mock_db(tasks)
    resp = _client(db).get(
        "/rhythms/saturday-sundown/preview",
        params={"instance_id": _INSTANCE},
    )
    body = resp.json()
    assert "deferred_tasks" in body
    assert any(t["id"] == "t2" for t in body["deferred_tasks"])


# ---------------------------------------------------------------------------
# POST /rhythms/saturday-sundown
# ---------------------------------------------------------------------------

def test_saturday_sundown_triggers_reweave() -> None:
    tasks = [
        {"id": "t1", "status": "completed"}, {"id": "t2", "status": "completed"},
        {"id": "t3", "status": "missed"},
    ]
    # Sequence: identity rows, tasks, then upsert identity day (×7), then insert session
    db = _mock_db_sequence(
        _IDENTITY_ROWS,
        tasks,
        *([[{"instance_id": _INSTANCE}]] * 7),  # 7 upsert calls → each returns a list
        [{"id": "session-001"}],               # sundown session insert
    )
    resp = _client(db).post(
        "/rhythms/saturday-sundown",
        json={"instance_id": _INSTANCE, "momentum_signal": "neutral"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "tone_branch" in body
    assert "completion_ratio" in body
    assert "capacity_update_narrative" in body


def test_saturday_sundown_invalid_signal_returns_422() -> None:
    resp = _client(_mock_db()).post(
        "/rhythms/saturday-sundown",
        json={"instance_id": _INSTANCE, "momentum_signal": "invalid_value"},
    )
    assert resp.status_code == 422
