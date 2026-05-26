"""
TDD: tests for routers/native.py — Phase 6 macOS/iOS native integration.

Endpoints:
  GET  /native/status          — system tray snapshot (today's capacity + tasks)
  POST /native/notify          — queue a local notification for Tauri to display
  POST /native/sync/identity   — OQ-07 iOS source-wins-by-last_updated sync
"""
from __future__ import annotations

from unittest.mock import MagicMock

from fastapi.testclient import TestClient

from jyriko.db.deps import require_db_client
from jyriko.main import create_app

_INSTANCE = "dddddddd-dddd-dddd-dddd-dddddddddddd"

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

_TASKS_TODAY = [
    {"id": "t1", "title": "Task A", "status": "scheduled", "cognitive_load": 0.3,
     "scheduled_date": "2026-03-22", "goal_id": "g1"},
    {"id": "t2", "title": "Task B", "status": "in_window", "cognitive_load": 0.4,
     "scheduled_date": "2026-03-22", "goal_id": "g1"},
]

_TASKS_FUTURE = [
    {"id": "t3", "title": "Task C", "status": "scheduled", "cognitive_load": 0.2,
     "scheduled_date": "2026-03-25", "goal_id": "g1"},
]


# ---------------------------------------------------------------------------
# GET /native/status
# ---------------------------------------------------------------------------

def test_status_returns_today_capacity() -> None:
    db = _mock_db_sequence(_IDENTITY_ROWS, _TASKS_TODAY + _TASKS_FUTURE)
    resp = _client(db).get(
        "/native/status",
        params={"instance_id": _INSTANCE, "date": "2026-03-22"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "today_capacity" in body
    assert isinstance(body["today_capacity"], float)


def test_status_returns_tasks_today() -> None:
    db = _mock_db_sequence(_IDENTITY_ROWS, _TASKS_TODAY + _TASKS_FUTURE)
    resp = _client(db).get(
        "/native/status",
        params={"instance_id": _INSTANCE, "date": "2026-03-22"},
    )
    body = resp.json()
    assert "tasks_today" in body
    # 2026-03-22 tasks only (t1 and t2)
    assert len(body["tasks_today"]) == 2


def test_status_returns_upcoming_count() -> None:
    db = _mock_db_sequence(_IDENTITY_ROWS, _TASKS_TODAY + _TASKS_FUTURE)
    resp = _client(db).get(
        "/native/status",
        params={"instance_id": _INSTANCE, "date": "2026-03-22"},
    )
    body = resp.json()
    assert "upcoming_count" in body
    # t3 is in the future (not today)
    assert body["upcoming_count"] == 1


def test_status_no_identity_rows_defaults_capacity() -> None:
    """When identity_state is empty, today_capacity defaults to 0.8."""
    db = _mock_db_sequence([], [])
    resp = _client(db).get(
        "/native/status",
        params={"instance_id": _INSTANCE, "date": "2026-03-22"},
    )
    assert resp.status_code == 200
    assert resp.json()["today_capacity"] == 0.8


# ---------------------------------------------------------------------------
# POST /native/notify
# ---------------------------------------------------------------------------

def test_notify_queues_notification() -> None:
    db = _mock_db([{"id": "notif-001", "title": "Task due", "body": "Do the thing"}])
    resp = _client(db).post(
        "/native/notify",
        json={
            "instance_id": _INSTANCE,
            "title": "Task due",
            "body": "Do the thing",
        },
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["status"] == "queued"
    assert "notification_id" in body


def test_notify_missing_title_returns_422() -> None:
    resp = _client(_mock_db()).post(
        "/native/notify",
        json={"instance_id": _INSTANCE, "body": "No title"},
    )
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# POST /native/sync/identity  (OQ-07: source-wins by last_updated)
# ---------------------------------------------------------------------------

def test_sync_identity_newer_incoming_wins() -> None:
    """If incoming last_updated > server last_updated, the row is synced."""
    existing = [
        {
            "day_of_week": 0,
            "declared_capacity": 0.7,
            "derived_capacity": 0.65,
            "week_number": 3,
            "last_updated": "2026-03-20T08:00:00Z",
        }
    ]
    db = _mock_db_sequence(
        existing,
        [{"instance_id": _INSTANCE, "day_of_week": 0}],  # upsert result
    )
    resp = _client(db).post(
        "/native/sync/identity",
        json={
            "instance_id": _INSTANCE,
            "rows": [
                {
                    "day_of_week": 0,
                    "declared_capacity": 0.85,
                    "derived_capacity": 0.80,
                    "week_number": 4,
                    "last_updated": "2026-03-22T10:00:00Z",
                }
            ],
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["synced"] == 1
    assert body["skipped"] == 0


def test_sync_identity_older_incoming_skipped() -> None:
    """If server last_updated >= incoming, the server row wins (skip)."""
    existing = [
        {
            "day_of_week": 1,
            "declared_capacity": 0.9,
            "derived_capacity": 0.88,
            "week_number": 4,
            "last_updated": "2026-03-22T12:00:00Z",  # newer
        }
    ]
    db = _mock_db_sequence(existing)
    resp = _client(db).post(
        "/native/sync/identity",
        json={
            "instance_id": _INSTANCE,
            "rows": [
                {
                    "day_of_week": 1,
                    "declared_capacity": 0.7,
                    "derived_capacity": 0.65,
                    "week_number": 3,
                    "last_updated": "2026-03-21T09:00:00Z",  # older
                }
            ],
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["synced"] == 0
    assert body["skipped"] == 1


def test_sync_identity_no_existing_row_always_synced() -> None:
    """Rows with no matching existing entry on the server are always upserted."""
    db = _mock_db_sequence(
        [],  # no existing rows
        [{"instance_id": _INSTANCE, "day_of_week": 3}],
    )
    resp = _client(db).post(
        "/native/sync/identity",
        json={
            "instance_id": _INSTANCE,
            "rows": [
                {
                    "day_of_week": 3,
                    "declared_capacity": 0.75,
                    "derived_capacity": 0.70,
                    "week_number": 4,
                    "last_updated": "2026-03-22T10:00:00Z",
                }
            ],
        },
    )
    assert resp.status_code == 200
    assert resp.json()["synced"] == 1


def test_sync_identity_mixed_batch() -> None:
    """Mixed batch: some rows win, some lose."""
    existing = [
        {
            "day_of_week": 0,
            "declared_capacity": 0.8,
            "derived_capacity": 0.75,
            "week_number": 4,
            "last_updated": "2026-03-22T06:00:00Z",  # server newer → skip incoming
        },
        {
            "day_of_week": 1,
            "declared_capacity": 0.6,
            "derived_capacity": 0.55,
            "week_number": 3,
            "last_updated": "2026-03-20T06:00:00Z",  # server older → incoming wins
        },
    ]
    db = _mock_db_sequence(
        existing,
        [{"instance_id": _INSTANCE, "day_of_week": 1}],  # upsert for day 1 only
    )
    resp = _client(db).post(
        "/native/sync/identity",
        json={
            "instance_id": _INSTANCE,
            "rows": [
                {
                    "day_of_week": 0,
                    "declared_capacity": 0.85,
                    "derived_capacity": 0.80,
                    "week_number": 4,
                    "last_updated": "2026-03-21T10:00:00Z",  # older than server
                },
                {
                    "day_of_week": 1,
                    "declared_capacity": 0.75,
                    "derived_capacity": 0.70,
                    "week_number": 4,
                    "last_updated": "2026-03-22T10:00:00Z",  # newer than server
                },
            ],
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["synced"] == 1
    assert body["skipped"] == 1
