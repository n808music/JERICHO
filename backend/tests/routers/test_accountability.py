"""
TDD: tests for routers/accountability.py.
Uses FastAPI dependency_overrides for correct DI injection.

Mock pattern: MagicMock for the Supabase builder chain (sync); async def
_execute() for the awaited .execute() call. This matches real Supabase
client behaviour — only execute() is a coroutine.
"""
from __future__ import annotations

from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from jyriko.db.deps import require_db_client
from jyriko.main import create_app

_INSTANCE_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
_INSTANCE_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"


_UNSET = object()  # sentinel distinguishing "no arg" from explicit None


def _mock_db(data: list | dict | None = _UNSET) -> MagicMock:  # type: ignore[assignment]
    """Supabase builder chain mock.  Only .execute() is async.

    _mock_db()      → data=[]    (default — nothing returned)
    _mock_db(None)  → data=None  (simulate maybe_single() row-not-found)
    _mock_db([...]) → data=[...] (specific rows)
    """
    db = MagicMock()
    db.table.return_value = db
    db.select.return_value = db
    db.eq.return_value = db
    db.maybe_single.return_value = db
    db.insert.return_value = db
    db.update.return_value = db
    db.delete.return_value = db
    db.order.return_value = db
    db.upsert.return_value = db

    _data = [] if data is _UNSET else data

    async def _execute() -> MagicMock:
        return MagicMock(data=_data)

    db.execute = _execute
    return db


def _mock_db_sequence(*responses: list | dict | None) -> MagicMock:
    """Return different data on successive .execute() calls."""
    db = MagicMock()
    db.table.return_value = db
    db.select.return_value = db
    db.eq.return_value = db
    db.maybe_single.return_value = db
    db.insert.return_value = db
    db.update.return_value = db
    db.delete.return_value = db
    db.order.return_value = db
    db.upsert.return_value = db

    idx = [0]

    async def _execute() -> MagicMock:
        val = responses[idx[0]] if idx[0] < len(responses) else None
        idx[0] += 1
        return MagicMock(data=val)

    db.execute = _execute
    return db


def _client(db: MagicMock) -> TestClient:
    app = create_app()
    app.dependency_overrides[require_db_client] = lambda: db
    return TestClient(app)


# ---------------------------------------------------------------------------
# POST /accountability/links
# ---------------------------------------------------------------------------

def test_create_link_returns_token() -> None:
    db = _mock_db([{
        "id": "link-001", "token": "tok_abc123",
        "scope": "summary_only", "owner_instance_id": _INSTANCE_A,
    }])
    resp = _client(db).post(
        "/accountability/links",
        json={"owner_instance_id": _INSTANCE_A, "scope": "summary_only"},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert "token" in body
    assert body["scope"] == "summary_only"


def test_create_link_token_is_present() -> None:
    db = _mock_db([{
        "id": "link-001", "token": "x" * 64,
        "scope": "goal_progress", "owner_instance_id": _INSTANCE_A,
    }])
    resp = _client(db).post(
        "/accountability/links",
        json={"owner_instance_id": _INSTANCE_A, "scope": "goal_progress"},
    )
    assert resp.status_code == 201
    assert "token" in resp.json()


# ---------------------------------------------------------------------------
# POST /accountability/links/activate
# ---------------------------------------------------------------------------

def test_activate_link_sets_viewer() -> None:
    link_row = {
        "id": "link-001", "token": "tok_abc",
        "owner_instance_id": _INSTANCE_A, "viewer_instance_id": None,
        "scope": "summary_only", "revoked_at": None,
    }
    # Sequence: select returns link, update returns updated row
    db = _mock_db_sequence(link_row, [{"id": "link-001"}])
    resp = _client(db).post(
        "/accountability/links/activate",
        json={"token": "tok_abc", "viewer_instance_id": _INSTANCE_B},
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "activated"


def test_activate_already_revoked_returns_410() -> None:
    db = _mock_db({
        "id": "link-001", "token": "tok_abc",
        "owner_instance_id": _INSTANCE_A, "viewer_instance_id": None,
        "scope": "summary_only", "revoked_at": "2026-01-01T00:00:00Z",
    })
    resp = _client(db).post(
        "/accountability/links/activate",
        json={"token": "tok_abc", "viewer_instance_id": _INSTANCE_B},
    )
    assert resp.status_code == 410


# ---------------------------------------------------------------------------
# DELETE /accountability/links/{link_id}
# ---------------------------------------------------------------------------

def test_revoke_sets_revoked_at_for_owner() -> None:
    db = _mock_db_sequence(
        {"id": "link-001", "owner_instance_id": _INSTANCE_A},
        [{"id": "link-001", "revoked_at": "2026-04-07T23:59:00Z"}],
    )
    resp = _client(db).delete(
        "/accountability/links/link-001",
        params={"instance_id": _INSTANCE_A},
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "revoked"


def test_revoke_nonexistent_link_returns_404() -> None:
    db = _mock_db(None)
    resp = _client(db).delete(
        "/accountability/links/no-such-link",
        params={"instance_id": _INSTANCE_A},
    )
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# GET /accountability/shared/{token}
# ---------------------------------------------------------------------------

def test_summary_only_scope_returns_no_task_titles() -> None:
    db = _mock_db_sequence(
        {"id": "l1", "token": "tok_s", "owner_instance_id": _INSTANCE_A,
         "scope": "summary_only", "revoked_at": None},
        [{"id": "g1", "title": "Learn Python"}],
        [{"id": "t1", "title": "Read chapter", "status": "completed", "goal_id": "g1"},
         {"id": "t2", "title": "Write code", "status": "missed", "goal_id": "g1"}],
    )
    resp = _client(db).get("/accountability/shared/tok_s")
    assert resp.status_code == 200
    body = resp.json()
    assert "completion_ratio" in body
    assert "task_titles" not in body
    assert "goals" not in body


def test_summary_only_completion_ratio_correct() -> None:
    db = _mock_db_sequence(
        {"id": "l1", "token": "tok_s", "owner_instance_id": _INSTANCE_A,
         "scope": "summary_only", "revoked_at": None},
        [],
        [{"id": "t1", "status": "completed", "goal_id": "g1"},
         {"id": "t2", "status": "missed", "goal_id": "g1"},
         {"id": "t3", "status": "completed", "goal_id": "g1"},
         {"id": "t4", "status": "missed", "goal_id": "g1"}],
    )
    resp = _client(db).get("/accountability/shared/tok_s")
    assert resp.json()["completion_ratio"] == pytest.approx(0.5)


def test_goal_progress_scope_includes_goal_titles() -> None:
    db = _mock_db_sequence(
        {"id": "l1", "token": "tok_gp", "owner_instance_id": _INSTANCE_A,
         "scope": "goal_progress", "revoked_at": None},
        [{"id": "g1", "title": "Learn Python"}],
        [{"id": "t1", "title": "Read chapter", "status": "completed", "goal_id": "g1"}],
    )
    resp = _client(db).get("/accountability/shared/tok_gp")
    assert resp.status_code == 200
    body = resp.json()
    assert "goals" in body
    assert any(g.get("title") for g in body["goals"])


def test_shared_revoked_token_returns_410() -> None:
    db = _mock_db({
        "id": "l1", "token": "tok_rev", "owner_instance_id": _INSTANCE_A,
        "scope": "summary_only", "revoked_at": "2026-01-01T00:00:00Z",
    })
    resp = _client(db).get("/accountability/shared/tok_rev")
    assert resp.status_code == 410
