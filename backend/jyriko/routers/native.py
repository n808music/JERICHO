"""
Native integration router — Phase 6 macOS/iOS.

Provides:
  GET  /native/status         — system tray snapshot for Tauri
  POST /native/notify         — queue a notification for Tauri to display
  POST /native/sync/identity  — OQ-07 iOS source-wins-by-last_updated sync
"""
from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Annotated, Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from supabase import AsyncClient

from jyriko.db.deps import require_db_client
from jyriko.db.repositories.identity import get_identity_state, upsert_identity_day
from jyriko.db.repositories.tasks import list_tasks
from jyriko.domain.sync import IdentitySyncRow, resolve_identity_rows

router = APIRouter(tags=["native"])

_ACTIVE_STATUSES = {"scheduled", "in_window"}
_DEFAULT_CAPACITY = 0.8


def _today_capacity(identity_rows: list[dict[str, Any]], query_date: date) -> float:
    """Return derived (or declared) capacity for the given date's day of week."""
    if not identity_rows:
        return _DEFAULT_CAPACITY
    target_dow = query_date.weekday()  # 0=Mon … 6=Sun
    by_day = {r["day_of_week"]: r for r in identity_rows}
    row = by_day.get(target_dow)
    if row is None:
        return _DEFAULT_CAPACITY
    return float(row.get("derived_capacity") or row.get("declared_capacity", _DEFAULT_CAPACITY))


# ---------------------------------------------------------------------------
# GET /native/status
# ---------------------------------------------------------------------------

@router.get("/status")
async def native_status(
    instance_id: str,
    date: str,
    db: Annotated[AsyncClient, Depends(require_db_client)],
) -> dict[str, Any]:
    """Return system tray snapshot: today's capacity, tasks due today, upcoming count."""
    identity_rows = await get_identity_state(db, instance_id)
    tasks = await list_tasks(db, instance_id)

    query_date = datetime.fromisoformat(date).date()
    date_str = date  # compare against task scheduled_date strings directly

    tasks_today = [
        t for t in tasks
        if t.get("scheduled_date") == date_str and t.get("status") in _ACTIVE_STATUSES
    ]
    upcoming = [
        t for t in tasks
        if t.get("scheduled_date", "") > date_str and t.get("status") in _ACTIVE_STATUSES
    ]

    return {
        "today_capacity": _today_capacity(identity_rows, query_date),
        "tasks_today": tasks_today,
        "upcoming_count": len(upcoming),
    }


# ---------------------------------------------------------------------------
# POST /native/notify
# ---------------------------------------------------------------------------

class NotifyRequest(BaseModel):
    instance_id: str
    title: str
    body: str


@router.post("/notify", status_code=201)
async def native_notify(
    body: NotifyRequest,
    db: Annotated[AsyncClient, Depends(require_db_client)],
) -> dict[str, Any]:
    """Queue a notification for Tauri to display in the system tray."""
    response = (
        await db.table("native_notifications")
        .insert({
            "instance_id": body.instance_id,
            "title": body.title,
            "body": body.body,
        })
        .execute()
    )
    row = response.data[0]
    return {"status": "queued", "notification_id": row["id"]}


# ---------------------------------------------------------------------------
# POST /native/sync/identity  — OQ-07 resolution
# ---------------------------------------------------------------------------

class IdentitySyncRowInput(BaseModel):
    day_of_week: int
    declared_capacity: float
    derived_capacity: float
    week_number: int
    last_updated: datetime


class IdentitySyncRequest(BaseModel):
    instance_id: str
    rows: list[IdentitySyncRowInput]


def _parse_server_row(row: dict[str, Any]) -> IdentitySyncRow | None:
    """Convert a Supabase identity_state row to IdentitySyncRow; None if no last_updated."""
    raw = row.get("last_updated")
    if raw is None:
        return None
    ts = datetime.fromisoformat(raw.replace("Z", "+00:00")) if isinstance(raw, str) else raw
    return IdentitySyncRow(
        day_of_week=row["day_of_week"],
        declared_capacity=float(row["declared_capacity"]),
        derived_capacity=float(row.get("derived_capacity") or row["declared_capacity"]),
        week_number=int(row.get("week_number", 1)),
        last_updated=ts,
    )


@router.post("/sync/identity")
async def sync_identity(
    body: IdentitySyncRequest,
    db: Annotated[AsyncClient, Depends(require_db_client)],
) -> dict[str, Any]:
    """Sync iOS identity_state rows: source-wins by last_updated."""
    server_rows_raw = await get_identity_state(db, body.instance_id)

    existing: list[IdentitySyncRow] = [
        parsed
        for row in server_rows_raw
        if (parsed := _parse_server_row(row)) is not None
    ]

    incoming: list[IdentitySyncRow] = [
        IdentitySyncRow(
            day_of_week=r.day_of_week,
            declared_capacity=r.declared_capacity,
            derived_capacity=r.derived_capacity,
            week_number=r.week_number,
            last_updated=r.last_updated,
        )
        for r in body.rows
    ]

    to_upsert, skipped = resolve_identity_rows(incoming, existing)

    for row in to_upsert:
        await upsert_identity_day(
            db,
            instance_id=body.instance_id,
            day_of_week=row.day_of_week,
            declared_capacity=row.declared_capacity,
            derived_capacity=row.derived_capacity,
            week_number=row.week_number,
            update_source="ios_sync",
        )

    return {"synced": len(to_upsert), "skipped": skipped}
