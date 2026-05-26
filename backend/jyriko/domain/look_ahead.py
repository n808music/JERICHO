"""
Look-ahead feathering algorithm — Phase 4.

Core contract: find the earliest day within a 14-day window that keeps
every day's load ratio below VIABLE_THRESHOLD (0.75).

Dependency semantics:
  blocking      — hard constraint; task cannot be placed before all blocking
                  deps have been placed on an earlier date.
  preferred_order — soft constraint; respected within the first
                  LOOK_AHEAD_DEFAULT_DAYS (7), relaxed beyond that.
  parallel_ok   — ignored for placement ordering.

Two-pass design: pass 1 enforces both hard + preferred constraints;
pass 2 relaxes preferred so capacity pressure doesn't force Viability Pause
when a later day would work fine.
"""
from __future__ import annotations

import graphlib
from collections.abc import Callable, Mapping, Sequence
from datetime import date, timedelta

from jyriko.constants import LOOK_AHEAD_DEFAULT_DAYS, LOOK_AHEAD_MAX_EXTENSION_DAYS, VIABLE_THRESHOLD
from jyriko.domain.types import CapacityVector, PlacementResult, Task
from jyriko.domain.viability import compute_load_ratio

_LARGE_PROXIMITY: int = 9_999  # sentinel: "no deadline" sorts last


def sort_tasks_for_placement(
    tasks: Sequence[Task],
    deadline_proximity: Mapping[str, int | None],
    dependency_blocking_factor: Mapping[str, int],
) -> tuple[Task, ...]:
    """Sort for greedy placement: urgent first, high-blocker first, light load first."""
    def _key(task: Task) -> tuple[int, int, float]:
        proximity = deadline_proximity.get(task.id)
        return (
            proximity if proximity is not None else _LARGE_PROXIMITY,
            -dependency_blocking_factor.get(task.id, 0),
            task.cognitive_load,
        )
    return tuple(sorted(tasks, key=_key))


def _capacity_for(d: date, capacity_vector: CapacityVector) -> float:
    return capacity_vector.values[d.weekday()]


def _fits(
    task: Task,
    day: date,
    daily_loads: Mapping[date, float],
    capacity_vector: CapacityVector,
) -> bool:
    capacity = _capacity_for(day, capacity_vector)
    if capacity <= 0.0:
        return False
    current = daily_loads.get(day, 0.0)
    return compute_load_ratio(current + task.cognitive_load, capacity) <= VIABLE_THRESHOLD


def find_placement_day(
    task: Task,
    blocking_dag: Mapping[str, frozenset[str]],
    preferred_dag: Mapping[str, frozenset[str]],
    already_placed: Mapping[str, date],
    daily_loads: Mapping[date, float],
    capacity_vector: CapacityVector,
    start_date: date,
    look_ahead_window: int = LOOK_AHEAD_DEFAULT_DAYS,
) -> date | None:
    """Return the earliest viable placement date, or None (→ Viability Pause)."""
    # Hard constraint: all blocking deps must be placed before this task.
    blocking_deps = blocking_dag.get(task.id, frozenset())
    for dep_id in blocking_deps:
        if dep_id not in already_placed:
            return None

    hard_dates = [already_placed[dep_id] for dep_id in blocking_deps]
    earliest_after_hard = max(hard_dates) + timedelta(days=1) if hard_dates else start_date

    preferred_deps = preferred_dag.get(task.id, frozenset())
    preferred_dates = [already_placed[d] for d in preferred_deps if d in already_placed]
    earliest_after_preferred = (
        max(preferred_dates) + timedelta(days=1) if preferred_dates else start_date
    )

    # Pass 1: respect both constraints (days 1..look_ahead_window).
    for offset in range(1, look_ahead_window + 1):
        day = start_date + timedelta(days=offset)
        if day < earliest_after_hard or day < earliest_after_preferred:
            continue
        if _fits(task, day, daily_loads, capacity_vector):
            return day

    # Pass 2: hard constraints only — preferred order relaxed (days look_ahead_window+1..max).
    for offset in range(look_ahead_window + 1, LOOK_AHEAD_MAX_EXTENSION_DAYS + 1):
        day = start_date + timedelta(days=offset)
        if day < earliest_after_hard:
            continue
        if _fits(task, day, daily_loads, capacity_vector):
            return day

    return None


def run_feathering(
    deferred_tasks: Sequence[Task],
    blocking_dag: Mapping[str, frozenset[str]],
    preferred_dag: Mapping[str, frozenset[str]],
    daily_loads: Mapping[date, float],
    capacity_vector: CapacityVector,
    start_date: date,
    ledger_writer: Callable[[Task, date | None], None],
    calendar_sync: Callable[[Task, date | None], None],
    pre_placed: Mapping[str, date] | None = None,
) -> tuple[PlacementResult, ...]:
    """Greedily place every deferred task and return placement results.

    Validates the combined DAG for cycles before any work.
    Side effects (ledger_writer, calendar_sync) fire once per task — even
    when unplaceable — so the audit trail is complete.
    """
    full_dag: dict[str, set[str]] = {
        task.id: set(
            blocking_dag.get(task.id, frozenset()) | preferred_dag.get(task.id, frozenset())
        )
        for task in deferred_tasks
    }
    sorter = graphlib.TopologicalSorter(full_dag)
    try:
        sorter.prepare()
    except graphlib.CycleError as exc:
        raise ValueError(f"Dependency cycle detected in feathering input: {exc}") from exc

    working_loads: dict[date, float] = dict(daily_loads)
    already_placed: dict[str, date] = dict(pre_placed or {})
    results: list[PlacementResult] = []

    for task in deferred_tasks:
        new_date = find_placement_day(
            task=task,
            blocking_dag=blocking_dag,
            preferred_dag=preferred_dag,
            already_placed=already_placed,
            daily_loads=working_loads,
            capacity_vector=capacity_vector,
            start_date=start_date,
        )

        if new_date is not None:
            working_loads[new_date] = working_loads.get(new_date, 0.0) + task.cognitive_load
            already_placed[task.id] = new_date

        load_ratio = 0.0
        if new_date is not None:
            capacity = _capacity_for(new_date, capacity_vector)
            if capacity > 0.0:
                load_ratio = compute_load_ratio(working_loads[new_date], capacity)

        ledger_writer(task, new_date)
        calendar_sync(task, new_date)
        results.append(PlacementResult(
            task_id=task.id,
            scheduled_date=new_date,
            load_ratio=load_ratio,
            was_deferred=new_date != task.scheduled_date,
        ))

    return tuple(results)
