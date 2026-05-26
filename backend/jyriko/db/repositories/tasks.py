"""
Tasks repository — Phase 2 Supabase backend.

Status values must match the CHECK constraint in migration 001.
"""
from __future__ import annotations

from datetime import date
from typing import Any, Literal

from supabase import AsyncClient

TaskStatusStr = Literal[
    "created", "scheduled", "in_window", "completed",
    "missed", "rescheduled", "viability_pause",
    "decomposed", "date_extended", "archived",
]


async def list_tasks(
    client: AsyncClient,
    instance_id: str,
    status: TaskStatusStr | None = None,
) -> list[dict[str, Any]]:
    query = client.table("tasks").select("*").eq("instance_id", instance_id)
    if status is not None:
        query = query.eq("status", status)
    response = await query.order("scheduled_date", desc=False).execute()
    return response.data


async def get_task(
    client: AsyncClient, instance_id: str, task_id: str
) -> dict[str, Any] | None:
    response = (
        await client.table("tasks")
        .select("*")
        .eq("instance_id", instance_id)
        .eq("id", task_id)
        .maybe_single()
        .execute()
    )
    return response.data


async def create_task(
    client: AsyncClient,
    instance_id: str,
    goal_id: str,
    title: str,
    task_type: str,
    importance_tier: str,
    estimated_duration_minutes: int,
    cognitive_load: float,
    scheduled_date: date | None = None,
    deadline: date | None = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "instance_id": instance_id,
        "goal_id": goal_id,
        "title": title,
        "status": "created",
        "task_type": task_type,
        "importance_tier": importance_tier,
        "estimated_duration_minutes": estimated_duration_minutes,
        "cognitive_load": cognitive_load,
        "deferral_count": 0,
    }
    if scheduled_date is not None:
        payload["scheduled_date"] = scheduled_date.isoformat()
    if deadline is not None:
        payload["deadline"] = deadline.isoformat()

    response = await client.table("tasks").insert(payload).execute()
    return response.data[0]


async def update_task_status(
    client: AsyncClient,
    instance_id: str,
    task_id: str,
    status: TaskStatusStr,
    deferral_increment: bool = False,
) -> dict[str, Any] | None:
    """Update task status, optionally incrementing deferral_count."""
    patch: dict[str, Any] = {"status": status}
    if deferral_increment:
        # Increment using a Supabase RPC or fetch-then-write pattern.
        # Fetch current deferral_count first (avoids a race in non-concurrent workloads).
        current = await get_task(client, instance_id, task_id)
        if current is None:
            return None
        patch["deferral_count"] = current.get("deferral_count", 0) + 1

    response = (
        await client.table("tasks")
        .update(patch)
        .eq("instance_id", instance_id)
        .eq("id", task_id)
        .execute()
    )
    return response.data[0] if response.data else None
