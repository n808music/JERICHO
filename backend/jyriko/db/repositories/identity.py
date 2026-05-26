"""
Identity state repository — Phase 2 Supabase backend.

identity_state has one row per (instance_id, day_of_week) pair (7 rows total).
The seed_cold_start_identity Postgres function (migration 003) initialises them.
"""
from __future__ import annotations

from typing import Any

from supabase import AsyncClient


async def get_identity_state(
    client: AsyncClient, instance_id: str
) -> list[dict[str, Any]]:
    """Return all 7 day-of-week rows for this instance, ordered by day_of_week."""
    response = (
        await client.table("identity_state")
        .select("*")
        .eq("instance_id", instance_id)
        .order("day_of_week", desc=False)
        .execute()
    )
    return response.data


async def upsert_identity_day(
    client: AsyncClient,
    instance_id: str,
    day_of_week: int,
    declared_capacity: float,
    derived_capacity: float | None = None,
    confidence_weight: float = 1.0,
    task_type_corrections: dict[str, Any] | None = None,
    week_number: int = 1,
    update_source: str = "user",
) -> dict[str, Any]:
    """Insert or update a single day's identity state row."""
    payload: dict[str, Any] = {
        "instance_id": instance_id,
        "day_of_week": day_of_week,
        "declared_capacity": declared_capacity,
        "confidence_weight": confidence_weight,
        "task_type_corrections": task_type_corrections or {},
        "week_number": week_number,
        "update_source": update_source,
    }
    if derived_capacity is not None:
        payload["derived_capacity"] = derived_capacity

    response = (
        await client.table("identity_state")
        .upsert(payload, on_conflict="instance_id,day_of_week")
        .execute()
    )
    return response.data[0]


async def seed_cold_start(
    client: AsyncClient, instance_id: str, declared_capacity: float
) -> None:
    """Call the seed_cold_start_identity Postgres function (migration 003)."""
    await client.rpc(
        "seed_cold_start_identity",
        {"p_instance_id": instance_id, "p_declared_capacity": declared_capacity},
    ).execute()
