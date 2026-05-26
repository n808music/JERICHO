"""
Goals repository — Phase 2 Supabase backend.

All functions are pure async: they take the client + params, return plain dicts.
RLS enforced server-side via `app.instance_id` session variable (set by middleware).
Client-side `instance_id` filter is defence-in-depth, not the primary guard.
"""
from __future__ import annotations

from typing import Any

from supabase import AsyncClient


async def list_goals(client: AsyncClient, instance_id: str) -> list[dict[str, Any]]:
    response = (
        await client.table("goals")
        .select("*")
        .eq("instance_id", instance_id)
        .order("created_at", desc=False)
        .execute()
    )
    return response.data


async def get_goal(
    client: AsyncClient, instance_id: str, goal_id: str
) -> dict[str, Any] | None:
    response = (
        await client.table("goals")
        .select("*")
        .eq("instance_id", instance_id)
        .eq("id", goal_id)
        .maybe_single()
        .execute()
    )
    return response.data


async def create_goal(
    client: AsyncClient, instance_id: str, title: str
) -> dict[str, Any]:
    response = (
        await client.table("goals")
        .insert({"instance_id": instance_id, "title": title})
        .execute()
    )
    return response.data[0]
