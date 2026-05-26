"""Tests for workers/scheduler.py — nightly rescheduler."""
from datetime import date, timedelta
from unittest.mock import AsyncMock, MagicMock

import pytest

from jyriko.workers.scheduler import create_scheduler, run_nightly_rescheduler


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _mock_db(rows_by_call: list[list[dict]]) -> MagicMock:
    """Return a mock Supabase client that yields successive response.data lists."""
    db = MagicMock()
    responses = iter([MagicMock(data=r) for r in rows_by_call])

    # Chain-call builder: db.table(...).select(...).eq(...).execute()
    # Every .table() call re-uses the same chained mock, execute() pops next response.
    chain = MagicMock()
    db.table.return_value = chain
    chain.select.return_value = chain
    chain.eq.return_value = chain
    chain.in_.return_value = chain
    chain.lt.return_value = chain
    chain.update.return_value = chain
    chain.insert.return_value = chain
    chain.order.return_value = chain
    chain.execute = AsyncMock(side_effect=lambda: next(responses))
    return db


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

async def test_nightly_skips_when_db_none():
    """Must return cleanly with no errors when db_client is None."""
    await run_nightly_rescheduler(None)


async def test_nightly_queries_tasks_table(monkeypatch):
    """When a real db is provided, at minimum the tasks table must be queried."""
    today = date.today()
    missed = {
        "id": "t1", "title": "Overdue", "status": "missed",
        "cognitive_load": 0.3,
        "scheduled_date": str(today - timedelta(days=2)),
        "goal_id": "g1", "deadline": None, "deferral_count": 1,
        "instance_id": "inst-001",
        "task_type": "execution", "importance_tier": "routine",
        "estimated_duration_minutes": 30,
    }
    identity = [
        {
            "day_of_week": i,
            "declared_capacity": 0.8,
            "derived_capacity": 0.75,
            "week_number": 4,
        }
        for i in range(7)
    ]
    db = _mock_db([[missed], identity, [], []])
    await run_nightly_rescheduler(db, instance_id="inst-001")
    db.table.assert_called()


async def test_nightly_updates_task_when_slot_found(monkeypatch):
    """When feathering finds a slot, tasks table must be updated."""
    today = date.today()
    missed = {
        "id": "t1", "title": "Overdue", "status": "missed",
        "cognitive_load": 0.3,
        "scheduled_date": str(today - timedelta(days=2)),
        "goal_id": "g1", "deadline": None, "deferral_count": 1,
        "instance_id": "inst-001",
        "task_type": "execution", "importance_tier": "routine",
        "estimated_duration_minutes": 30,
    }
    identity = [
        {
            "day_of_week": i,
            "declared_capacity": 0.8,
            "derived_capacity": 0.75,
            "week_number": 4,
        }
        for i in range(7)
    ]
    db = _mock_db([[missed], identity, [], []])
    await run_nightly_rescheduler(db, instance_id="inst-001")
    db.table.assert_called()
    # update must have been called at least once for the rescheduled task
    db.table.return_value.update.assert_called()


async def test_create_scheduler_returns_configured_scheduler():
    """create_scheduler must return an AsyncIOScheduler with the nightly job."""
    from apscheduler.schedulers.asyncio import AsyncIOScheduler
    scheduler = create_scheduler(None)
    assert isinstance(scheduler, AsyncIOScheduler)
    job = scheduler.get_job("nightly_rescheduler")
    assert job is not None


async def test_nightly_handles_empty_task_list():
    """When no overdue tasks exist, scheduler must complete without error."""
    db = _mock_db([[]])  # empty tasks response
    await run_nightly_rescheduler(db, instance_id="inst-001")


async def test_ledger_written_after_rescheduling():
    """A decision_ledger insert must fire for each successfully placed task."""
    today = date.today()
    missed = {
        "id": "t1", "title": "Overdue", "status": "missed",
        "cognitive_load": 0.3,
        "scheduled_date": str(today - timedelta(days=2)),
        "goal_id": "g1", "deadline": None, "deferral_count": 1,
        "instance_id": "inst-001",
        "task_type": "execution", "importance_tier": "flexible",
        "estimated_duration_minutes": 30,
    }
    identity = [
        {
            "day_of_week": i,
            "declared_capacity": 0.8,
            "derived_capacity": 0.75,
            "week_number": 4,
        }
        for i in range(7)
    ]
    # Four DB calls: tasks query, identity query, task update, ledger insert
    db = _mock_db([[missed], identity, [], []])
    await run_nightly_rescheduler(db, instance_id="inst-001")
    ledger_calls = [c for c in db.table.call_args_list if c.args == ("decision_ledger",)]
    assert len(ledger_calls) >= 1
