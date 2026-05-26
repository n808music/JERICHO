"""
Accountability Links router — Phase 5.

Link lifecycle:
  1. Owner generates a scoped token (POST /accountability/links)
  2. Viewer enters token to activate (POST /accountability/links/activate)
  3. Either party revokes (DELETE /accountability/links/{id})
  4. Viewer polls shared data (GET /accountability/shared/{token})

OQ-09 resolution: revocation sets revoked_at on the link row (owner side
retains all accountability_link_events permanently); viewer-side data
is soft-deleted with a 30-day TTL (handled by the caller's instance).

Share scopes (PRD §3.8):
  SUMMARY_ONLY  — completion_ratio + momentum signal only; no task/goal content
  GOAL_PROGRESS — goal titles + per-goal completion status
  FULL_SUMMARY  — all of GOAL_PROGRESS + narrative summary text
"""
from __future__ import annotations

import secrets
from datetime import datetime, timezone
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from supabase import AsyncClient

from jyriko.constants import ACCOUNTABILITY_TOKEN_BYTES
from jyriko.db.deps import require_db_client

router = APIRouter(tags=["accountability"])

ShareScope = Literal["summary_only", "goal_progress", "full_summary"]

_TERMINAL_STATUSES = {"completed", "archived", "decomposed"}


# ---------------------------------------------------------------------------
# POST /accountability/links
# ---------------------------------------------------------------------------

class CreateLinkRequest(BaseModel):
    owner_instance_id: str
    scope: ShareScope = "summary_only"


@router.post("/links", status_code=201)
async def create_link(
    body: CreateLinkRequest,
    db: Annotated[AsyncClient, Depends(require_db_client)],
) -> dict[str, Any]:
    """Generate a scoped share token for the owner instance."""
    token = secrets.token_urlsafe(ACCOUNTABILITY_TOKEN_BYTES)
    response = await (
        db.table("accountability_links")
        .insert({
            "owner_instance_id": body.owner_instance_id,
            "token": token,
            "scope": body.scope,
        })
        .execute()
    )
    row: dict[str, Any] = response.data[0]
    return {"id": row["id"], "token": row["token"], "scope": row["scope"]}


# ---------------------------------------------------------------------------
# POST /accountability/links/activate
# ---------------------------------------------------------------------------

class ActivateLinkRequest(BaseModel):
    token: str
    viewer_instance_id: str


@router.post("/links/activate")
async def activate_link(
    body: ActivateLinkRequest,
    db: Annotated[AsyncClient, Depends(require_db_client)],
) -> dict[str, Any]:
    """Link viewer instance to owner using a share token."""
    response = await (
        db.table("accountability_links")
        .select("*")
        .eq("token", body.token)
        .maybe_single()
        .execute()
    )
    link = response.data
    if link is None:
        raise HTTPException(status_code=404, detail="Token not found")
    if link.get("revoked_at") is not None:
        raise HTTPException(status_code=410, detail="Token has been revoked")

    await (
        db.table("accountability_links")
        .update({"viewer_instance_id": body.viewer_instance_id})
        .eq("id", link["id"])
        .execute()
    )
    return {"status": "activated", "link_id": link["id"], "scope": link["scope"]}


# ---------------------------------------------------------------------------
# DELETE /accountability/links/{link_id}
# ---------------------------------------------------------------------------

@router.delete("/links/{link_id}")
async def revoke_link(
    link_id: str,
    instance_id: str,
    db: Annotated[AsyncClient, Depends(require_db_client)],
) -> dict[str, Any]:
    """Revoke a link. Owner side retains events (OQ-09); viewer side TTL = 30d."""
    response = await (
        db.table("accountability_links")
        .select("id, owner_instance_id")
        .eq("id", link_id)
        .eq("owner_instance_id", instance_id)
        .maybe_single()
        .execute()
    )
    if response.data is None:
        raise HTTPException(status_code=404, detail="Link not found")

    now_iso = datetime.now(timezone.utc).isoformat()
    revoke_response = await (
        db.table("accountability_links")
        .update({"revoked_at": now_iso})
        .eq("id", link_id)
        .execute()
    )
    return {"status": "revoked", "link_id": link_id}


# ---------------------------------------------------------------------------
# GET /accountability/shared/{token}
# ---------------------------------------------------------------------------

def _build_scoped_payload(
    scope: ShareScope,
    goals: list[dict[str, Any]],
    tasks: list[dict[str, Any]],
    narrative: str | None = None,
) -> dict[str, Any]:
    """Return only fields permitted by the share scope."""
    completed = sum(1 for t in tasks if t.get("status") == "completed")
    total = len(tasks)
    completion_ratio = completed / total if total > 0 else 0.0

    if scope == "summary_only":
        return {"completion_ratio": completion_ratio, "total_tasks": total}

    goal_statuses = []
    for goal in goals:
        goal_tasks = [t for t in tasks if t.get("goal_id") == goal["id"]]
        done = sum(1 for t in goal_tasks if t.get("status") in _TERMINAL_STATUSES)
        entry: dict[str, Any] = {
            "id": goal["id"],
            "title": goal["title"],
            "completed": done,
            "total": len(goal_tasks),
        }
        goal_statuses.append(entry)

    payload: dict[str, Any] = {
        "completion_ratio": completion_ratio,
        "goals": goal_statuses,
    }

    if scope == "full_summary" and narrative:
        payload["narrative_summary"] = narrative

    return payload


@router.get("/shared/{token}")
async def get_shared_data(
    token: str,
    db: Annotated[AsyncClient, Depends(require_db_client)],
) -> dict[str, Any]:
    """Return scoped data for a share token (polling endpoint)."""
    link_resp = await (
        db.table("accountability_links")
        .select("*")
        .eq("token", token)
        .maybe_single()
        .execute()
    )
    link = link_resp.data
    if link is None:
        raise HTTPException(status_code=404, detail="Token not found")
    if link.get("revoked_at") is not None:
        raise HTTPException(status_code=410, detail="Link has been revoked")

    owner_id = link["owner_instance_id"]
    scope: ShareScope = link["scope"]

    goals_resp = await (
        db.table("goals").select("id, title").eq("instance_id", owner_id).execute()
    )
    tasks_resp = await (
        db.table("tasks")
        .select("id, title, status, goal_id")
        .eq("instance_id", owner_id)
        .execute()
    )

    return _build_scoped_payload(
        scope=scope,
        goals=goals_resp.data or [],
        tasks=tasks_resp.data or [],
    )
