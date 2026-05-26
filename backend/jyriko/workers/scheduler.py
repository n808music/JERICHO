"""
Nightly rescheduler — Phase 4.

Runs at 23:59 daily. Fetches all instances with overdue tasks from Supabase,
then runs the feathering algorithm per instance to find new slots.
When db_client is None (JSON-adapter / Phase 0 mode), the job exits cleanly.
"""
from __future__ import annotations

import logging
from datetime import date

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from jyriko.domain.capacity_profile import apply_cold_start
from jyriko.domain.look_ahead import run_feathering, sort_tasks_for_placement
from jyriko.domain.types import CapacityVector, Task, TaskStatus

log = logging.getLogger(__name__)

_OVERDUE_STATUSES = ("missed", "rescheduled")


def _row_to_task(row: dict) -> Task:
    return Task(
        id=row["id"],
        goal_id=row.get("goal_id", ""),
        title=row.get("title", ""),
        status=row.get("status", TaskStatus.MISSED.value),
        task_type=row.get("task_type", "execution"),
        importance_tier=row.get("importance_tier", "routine"),
        estimated_duration_minutes=int(row.get("estimated_duration_minutes", 30)),
        cognitive_load=float(row.get("cognitive_load", 0.3)),
        deferral_count=int(row.get("deferral_count", 0)),
        instance_id=row.get("instance_id", ""),
    )


def _build_capacity_vector(identity_rows: list[dict]) -> CapacityVector:
    """Build a 7-slot CapacityVector from identity_state rows (one per day_of_week)."""
    slots = [0.75] * 7  # sensible default if rows are missing
    for row in identity_rows:
        day = int(row.get("day_of_week", 0))
        week_number = int(row.get("week_number", 4))
        declared = float(row.get("declared_capacity", 0.75))
        derived = float(row.get("derived_capacity", declared))
        # Cold-start applies during first 3 weeks; after that, use derived capacity.
        effective = apply_cold_start(declared, week_number) if week_number <= 3 else derived
        if 0 <= day < 7:
            slots[day] = effective
    return CapacityVector(values=tuple(slots))


async def run_nightly_rescheduler(
    db_client: object | None,
    instance_id: str | None = None,
) -> None:
    """Entry point for the nightly 23:59 job.

    *instance_id*: if provided, only reschedule tasks for that instance
    (used in integration tests). In production, fetches all active instances.
    """
    if db_client is None:
        log.debug("Nightly rescheduler skipped — no Supabase client configured")
        return

    log.info("Nightly rescheduler starting")
    today = date.today()
    today_str = today.isoformat()

    # 1. Fetch overdue tasks (optionally filtered by instance_id).
    query = (
        db_client.table("tasks")  # type: ignore[union-attr]
        .select("*")
        .in_("status", list(_OVERDUE_STATUSES))
        .lt("scheduled_date", today_str)
    )
    if instance_id:
        query = query.eq("instance_id", instance_id)

    task_resp = await query.execute()
    rows: list[dict] = task_resp.data or []

    if not rows:
        log.info("Nightly rescheduler: no overdue tasks found")
        return

    # 2. Group by instance_id.
    by_instance: dict[str, list[dict]] = {}
    for row in rows:
        iid = row.get("instance_id", "")
        by_instance.setdefault(iid, []).append(row)

    # 3. For each instance: load capacity, run feathering, persist updates.
    for iid, task_rows in by_instance.items():
        identity_resp = await (
            db_client.table("identity_state")  # type: ignore[union-attr]
            .select("*")
            .eq("instance_id", iid)
            .execute()
        )
        identity_rows: list[dict] = identity_resp.data or []
        capacity_vector = _build_capacity_vector(identity_rows)

        tasks = [_row_to_task(r) for r in task_rows]
        sorted_tasks = sort_tasks_for_placement(tasks, {}, {})

        # Track original dates for ledger entries (before feathering overwrites).
        original_dates: dict[str, date | None] = {
            r.get("id", ""): (
                date.fromisoformat(r["scheduled_date"]) if r.get("scheduled_date") else None
            )
            for r in task_rows
        }

        results = run_feathering(
            deferred_tasks=sorted_tasks,
            blocking_dag={},
            preferred_dag={},
            daily_loads={},
            capacity_vector=capacity_vector,
            start_date=today,
            ledger_writer=lambda t, d: None,  # sync; async ledger written below
            calendar_sync=lambda t, d: None,  # calendar sync deferred to Phase 5
        )

        # 4. Persist placements + decision-ledger entries.
        for result in results:
            if result.scheduled_date is None:
                continue
            await (
                db_client.table("tasks")  # type: ignore[union-attr]
                .update({
                    "scheduled_date": result.scheduled_date.isoformat(),
                    "status": TaskStatus.RESCHEDULED.value,
                })
                .eq("id", result.task_id)
                .execute()
            )
            from_date = original_dates.get(result.task_id)
            await (
                db_client.table("decision_ledger")  # type: ignore[union-attr]
                .insert({
                    "instance_id": iid,
                    "task_id": result.task_id,
                    "decision_type": "feathering_placement",
                    "from_date": str(from_date) if from_date else None,
                    "to_date": result.scheduled_date.isoformat(),
                    "reason_code": "overdue_reschedule",
                    "load_ratio_dest": result.load_ratio,
                    "algorithm_version": "2.0",
                })
                .execute()
            )

    log.info("Nightly rescheduler complete — processed %d instances", len(by_instance))


def create_scheduler(db_client: object | None) -> AsyncIOScheduler:
    """Build and return a configured (but not yet started) AsyncIOScheduler."""
    scheduler = AsyncIOScheduler()
    scheduler.add_job(
        run_nightly_rescheduler,
        trigger=CronTrigger(hour=23, minute=59),
        kwargs={"db_client": db_client},
        id="nightly_rescheduler",
        name="Nightly task rescheduler",
        replace_existing=True,
        misfire_grace_time=300,
    )
    return scheduler
