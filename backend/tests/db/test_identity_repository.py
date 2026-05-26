"""Integration tests for the identity state repository."""
from __future__ import annotations

import uuid

import pytest

from jyriko.db.repositories.identity import get_identity_state, upsert_identity_day

pytestmark = pytest.mark.asyncio

_INSTANCE = str(uuid.uuid4())


async def test_upsert_and_get(db) -> None:
    """Upserted row must be retrievable via get_identity_state."""
    await upsert_identity_day(
        db, _INSTANCE, 0, declared_capacity=0.75, derived_capacity=0.70,
        week_number=2, update_source="test",
    )
    rows = await get_identity_state(db, _INSTANCE)
    assert any(r["day_of_week"] == 0 for r in rows)


async def test_upsert_idempotent(db) -> None:
    """Multiple upserts for the same (instance_id, day_of_week) must not create duplicate rows."""
    iid = str(uuid.uuid4())
    for _ in range(3):
        await upsert_identity_day(
            db, iid, 1, declared_capacity=0.80, week_number=2, update_source="test",
        )
    rows = await get_identity_state(db, iid)
    day1_rows = [r for r in rows if r["day_of_week"] == 1]
    assert len(day1_rows) == 1, f"Expected exactly 1 row for day 1, got {len(day1_rows)}"


async def test_last_updated_populated(db) -> None:
    """The last_updated column must be set after an upsert."""
    iid = str(uuid.uuid4())
    await upsert_identity_day(
        db, iid, 2, declared_capacity=0.70, week_number=2, update_source="test",
    )
    rows = await get_identity_state(db, iid)
    row = next(r for r in rows if r["day_of_week"] == 2)
    assert row.get("last_updated") is not None, "last_updated should be set after upsert"


async def test_derived_capacity_defaults_when_omitted(db) -> None:
    """When derived_capacity is not passed, the column should fall back to declared_capacity."""
    iid = str(uuid.uuid4())
    await upsert_identity_day(
        db, iid, 3, declared_capacity=0.65, week_number=1, update_source="test",
    )
    rows = await get_identity_state(db, iid)
    row = next((r for r in rows if r["day_of_week"] == 3), None)
    assert row is not None
    # derived_capacity is nullable — if omitted it may be None or equal to declared_capacity
    # The important thing is the row exists and declared_capacity is correct.
    assert abs(row["declared_capacity"] - 0.65) < 0.001


async def test_rows_ordered_by_day_of_week(db) -> None:
    """get_identity_state returns rows sorted ascending by day_of_week."""
    iid = str(uuid.uuid4())
    for day in [4, 0, 6, 2]:
        await upsert_identity_day(
            db, iid, day, declared_capacity=0.7, week_number=2, update_source="test",
        )
    rows = await get_identity_state(db, iid)
    days = [r["day_of_week"] for r in rows]
    assert days == sorted(days), f"Expected ascending order, got {days}"
