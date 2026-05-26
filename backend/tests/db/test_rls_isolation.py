"""Integration tests for Row-Level Security isolation between instances."""
from __future__ import annotations

import uuid

import pytest

pytestmark = pytest.mark.asyncio

INSTANCE_A = str(uuid.uuid4())
INSTANCE_B = str(uuid.uuid4())


async def test_cross_instance_read_returns_empty(db) -> None:
    """Data written for instance A must not be readable when querying for instance B."""
    await (
        db.table("identity_state")
        .upsert(
            {
                "instance_id": INSTANCE_A,
                "day_of_week": 0,
                "declared_capacity": 0.8,
                "derived_capacity": 0.75,
                "confidence_weight": 1.0,
                "task_type_corrections": {},
                "week_number": 1,
                "update_source": "rls_test",
            },
            on_conflict="instance_id,day_of_week",
        )
        .execute()
    )

    resp = await (
        db.table("identity_state")
        .select("*")
        .eq("instance_id", INSTANCE_B)
        .execute()
    )
    assert resp.data == [], (
        f"Expected empty result for instance {INSTANCE_B}, got {resp.data}"
    )


async def test_same_instance_read_returns_data(db) -> None:
    """Data written for an instance must be readable when querying that same instance."""
    iid = str(uuid.uuid4())
    await (
        db.table("identity_state")
        .upsert(
            {
                "instance_id": iid,
                "day_of_week": 1,
                "declared_capacity": 0.6,
                "derived_capacity": 0.6,
                "confidence_weight": 1.0,
                "task_type_corrections": {},
                "week_number": 2,
                "update_source": "rls_test",
            },
            on_conflict="instance_id,day_of_week",
        )
        .execute()
    )
    resp = await (
        db.table("identity_state")
        .select("*")
        .eq("instance_id", iid)
        .execute()
    )
    assert any(r["day_of_week"] == 1 for r in resp.data), (
        f"Expected day_of_week=1 row for instance {iid}, got {resp.data}"
    )
