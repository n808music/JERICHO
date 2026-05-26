"""Tests for domain/look_ahead.py — feathering algorithm."""
from __future__ import annotations

from datetime import date, timedelta

import pytest

from jyriko.constants import LOOK_AHEAD_DEFAULT_DAYS, LOOK_AHEAD_MAX_EXTENSION_DAYS, VIABLE_THRESHOLD
from jyriko.domain.look_ahead import find_placement_day, run_feathering, sort_tasks_for_placement
from jyriko.domain.types import CapacityVector, PlacementResult, Task, TaskStatus

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

_TODAY = date(2026, 4, 7)  # fixed Tuesday

# Uniform capacity: 1.0 every day (simplifies load ratio math)
_FULL_CAP = CapacityVector(values=(1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0))

# Capacity that makes weekend (Sat=5, Sun=6) zero — forces weekday-only placement
_WEEKDAY_CAP = CapacityVector(values=(1.0, 1.0, 1.0, 1.0, 1.0, 0.0, 0.0))


def _task(
    task_id: str,
    cognitive_load: float = 0.4,
    deferral_count: int = 0,
    scheduled_date: date | None = None,
    deadline: date | None = None,
) -> Task:
    return Task(
        id=task_id,
        goal_id="goal-1",
        title=task_id,
        status=TaskStatus.SCHEDULED,
        task_type="execution",
        importance_tier="routine",
        estimated_duration_minutes=60,
        cognitive_load=cognitive_load,
        deferral_count=deferral_count,
        dependencies=(),
        scheduled_date=scheduled_date,
        deadline=deadline,
    )


_NO_BLOCKING: dict[str, frozenset[str]] = {}
_NO_PREFERRED: dict[str, frozenset[str]] = {}

# ---------------------------------------------------------------------------
# sort_tasks_for_placement
# ---------------------------------------------------------------------------


def test_sort_deadline_proximity_ascending() -> None:
    tasks = [_task("a"), _task("b"), _task("c")]
    proximity = {"a": 10, "b": 2, "c": 5}
    blocking_factor: dict[str, int] = {}
    result = sort_tasks_for_placement(tasks, proximity, blocking_factor)
    assert [t.id for t in result] == ["b", "c", "a"]


def test_sort_no_deadline_goes_last() -> None:
    tasks = [_task("x"), _task("y")]
    proximity: dict[str, int | None] = {"x": None, "y": 3}
    result = sort_tasks_for_placement(tasks, proximity, {})
    assert result[0].id == "y"
    assert result[1].id == "x"


def test_sort_blocking_factor_tiebreak() -> None:
    tasks = [_task("a"), _task("b")]
    proximity: dict[str, int | None] = {"a": 5, "b": 5}
    blocking = {"a": 1, "b": 3}
    result = sort_tasks_for_placement(tasks, proximity, blocking)
    # b blocks more → placed first
    assert result[0].id == "b"


def test_sort_cognitive_load_tiebreak() -> None:
    tasks = [_task("a", cognitive_load=0.8), _task("b", cognitive_load=0.2)]
    result = sort_tasks_for_placement(tasks, {}, {})
    # lower cognitive_load first when all else equal
    assert result[0].id == "b"


# ---------------------------------------------------------------------------
# find_placement_day — basic placement
# ---------------------------------------------------------------------------


def test_finds_first_day_within_window() -> None:
    day = find_placement_day(
        task=_task("t1"),
        blocking_dag=_NO_BLOCKING,
        preferred_dag=_NO_PREFERRED,
        already_placed={},
        daily_loads={},
        capacity_vector=_FULL_CAP,
        start_date=_TODAY,
    )
    assert day == _TODAY + timedelta(days=1)


def test_no_overload_above_viable_threshold() -> None:
    """A day already at max load must be skipped."""
    # 0.75 exactly is the threshold — task with load 0.4 would push ratio to 1.15 → skip
    overloaded_day = _TODAY + timedelta(days=1)
    loads = {overloaded_day: VIABLE_THRESHOLD}  # ratio already = 0.75; adding 0.4 → 1.15
    day = find_placement_day(
        task=_task("t1", cognitive_load=0.4),
        blocking_dag=_NO_BLOCKING,
        preferred_dag=_NO_PREFERRED,
        already_placed={},
        daily_loads=loads,
        capacity_vector=_FULL_CAP,
        start_date=_TODAY,
    )
    # Must not place on overloaded_day — should find the next open day
    assert day is not None
    assert day != overloaded_day


# ---------------------------------------------------------------------------
# find_placement_day — blocking dependencies
# ---------------------------------------------------------------------------


def test_blocking_dep_prevents_placement_before_dep() -> None:
    """Task B cannot be placed until after Task A is placed."""
    blocking_dag = {"b": frozenset({"a"})}
    a_placed_on = _TODAY + timedelta(days=3)
    already_placed = {"a": a_placed_on}

    day = find_placement_day(
        task=_task("b"),
        blocking_dag=blocking_dag,
        preferred_dag=_NO_PREFERRED,
        already_placed=already_placed,
        daily_loads={},
        capacity_vector=_FULL_CAP,
        start_date=_TODAY,
    )
    assert day is not None
    assert day > a_placed_on


def test_blocking_dep_unplaced_returns_none() -> None:
    """If blocking dep has no placement, task cannot be scheduled."""
    blocking_dag = {"b": frozenset({"a"})}
    day = find_placement_day(
        task=_task("b"),
        blocking_dag=blocking_dag,
        preferred_dag=_NO_PREFERRED,
        already_placed={},  # "a" not placed
        daily_loads={},
        capacity_vector=_FULL_CAP,
        start_date=_TODAY,
    )
    assert day is None


# ---------------------------------------------------------------------------
# find_placement_day — preferred_order relaxation
# ---------------------------------------------------------------------------


def test_preferred_order_respected_within_window() -> None:
    """Within 7 days, preferred dep date is respected."""
    preferred_dag = {"b": frozenset({"a"})}
    a_placed_on = _TODAY + timedelta(days=4)
    already_placed = {"a": a_placed_on}

    day = find_placement_day(
        task=_task("b"),
        blocking_dag=_NO_BLOCKING,
        preferred_dag=preferred_dag,
        already_placed=already_placed,
        daily_loads={},
        capacity_vector=_FULL_CAP,
        start_date=_TODAY,
    )
    assert day is not None
    assert day > a_placed_on


def test_preferred_order_relaxed_when_load_full_in_first_window() -> None:
    """When all days 1-7 are at capacity, preferred order is relaxed in days 8-14."""
    preferred_dag = {"b": frozenset({"a"})}
    # "a" was placed very late — preferred constraint would push "b" beyond day 14
    a_placed_on = _TODAY + timedelta(days=12)
    already_placed = {"a": a_placed_on}

    # Fill days 1-12 to capacity so they can't be used
    loads = {_TODAY + timedelta(days=i): VIABLE_THRESHOLD for i in range(1, 13)}

    day = find_placement_day(
        task=_task("b"),
        blocking_dag=_NO_BLOCKING,
        preferred_dag=preferred_dag,
        already_placed=already_placed,
        daily_loads=loads,
        capacity_vector=_FULL_CAP,
        start_date=_TODAY,
    )
    # Days 1-12 are full; preferred constraint (after day 12) also eliminates 8-12.
    # Pass 2 relaxes preferred → should find day 13.
    # Actually: all of days 8-12 are full in loads, and day 13+ satisfies pass 2.
    # a_placed_on = day 12; pass 2 ignores preferred → check days 8-14 without preferred.
    # Day 8-12 are full. Day 13 is empty → should place there.
    assert day == _TODAY + timedelta(days=13)


# ---------------------------------------------------------------------------
# find_placement_day — 14-day full → None
# ---------------------------------------------------------------------------


def test_all_14_days_full_returns_none() -> None:
    """No slot in 14-day window → return None (triggers Viability Pause)."""
    loads = {
        _TODAY + timedelta(days=i): VIABLE_THRESHOLD
        for i in range(1, LOOK_AHEAD_MAX_EXTENSION_DAYS + 1)
    }
    day = find_placement_day(
        task=_task("t1"),
        blocking_dag=_NO_BLOCKING,
        preferred_dag=_NO_PREFERRED,
        already_placed={},
        daily_loads=loads,
        capacity_vector=_FULL_CAP,
        start_date=_TODAY,
    )
    assert day is None


# ---------------------------------------------------------------------------
# find_placement_day — anchor event capacity buffer
# ---------------------------------------------------------------------------


def test_anchor_event_reduces_available_capacity() -> None:
    """Pre-loading ANCHOR_EVENT_CAPACITY_BUFFER * capacity simulates a calendar anchor."""
    from jyriko.constants import ANCHOR_EVENT_CAPACITY_BUFFER

    # Anchor event consumes 20% of capacity on day 1
    day1 = _TODAY + timedelta(days=1)
    anchor_load = ANCHOR_EVENT_CAPACITY_BUFFER * _FULL_CAP.values[day1.weekday()]

    # Task with cognitive_load 0.6 — anchor (0.2) + task (0.6) = 0.8 > 0.75 threshold
    heavy_task = _task("t1", cognitive_load=0.6)
    day = find_placement_day(
        task=heavy_task,
        blocking_dag=_NO_BLOCKING,
        preferred_dag=_NO_PREFERRED,
        already_placed={},
        daily_loads={day1: anchor_load},
        capacity_vector=_FULL_CAP,
        start_date=_TODAY,
    )
    # Day 1 should be skipped (ratio would be 0.8), day 2 is available
    assert day is not None
    assert day != day1


# ---------------------------------------------------------------------------
# run_feathering
# ---------------------------------------------------------------------------


def test_feathering_places_all_tasks() -> None:
    tasks = [_task("a"), _task("b"), _task("c")]
    calls: list[tuple[str, object]] = []

    results = run_feathering(
        deferred_tasks=tasks,
        blocking_dag=_NO_BLOCKING,
        preferred_dag=_NO_PREFERRED,
        daily_loads={},
        capacity_vector=_FULL_CAP,
        start_date=_TODAY,
        ledger_writer=lambda t, d: calls.append(("ledger", t.id)),
        calendar_sync=lambda t, d: calls.append(("sync", t.id)),
    )

    assert len(results) == 3
    assert all(r.scheduled_date is not None for r in results)
    # Both callbacks called for each task
    assert len([c for c in calls if c[0] == "ledger"]) == 3
    assert len([c for c in calls if c[0] == "sync"]) == 3


def test_feathering_no_day_exceeds_viable_threshold() -> None:
    tasks = [_task(str(i), cognitive_load=0.3) for i in range(4)]
    results = run_feathering(
        deferred_tasks=tasks,
        blocking_dag=_NO_BLOCKING,
        preferred_dag=_NO_PREFERRED,
        daily_loads={},
        capacity_vector=_FULL_CAP,
        start_date=_TODAY,
        ledger_writer=lambda *_: None,
        calendar_sync=lambda *_: None,
    )
    for r in results:
        assert r.load_ratio <= VIABLE_THRESHOLD


def test_feathering_blocking_order_maintained() -> None:
    """Task b cannot appear on same or earlier day than task a (blocking dep)."""
    a = _task("a")
    b = _task("b")
    blocking_dag = {"b": frozenset({"a"})}
    results = run_feathering(
        deferred_tasks=[a, b],
        blocking_dag=blocking_dag,
        preferred_dag=_NO_PREFERRED,
        daily_loads={},
        capacity_vector=_FULL_CAP,
        start_date=_TODAY,
        ledger_writer=lambda *_: None,
        calendar_sync=lambda *_: None,
    )
    r_a = next(r for r in results if r.task_id == "a")
    r_b = next(r for r in results if r.task_id == "b")
    assert r_a.scheduled_date is not None
    assert r_b.scheduled_date is not None
    assert r_b.scheduled_date > r_a.scheduled_date


def test_feathering_cycle_raises() -> None:
    a, b = _task("a"), _task("b")
    blocking_dag = {"a": frozenset({"b"}), "b": frozenset({"a"})}
    with pytest.raises(ValueError, match="cycle"):
        run_feathering(
            deferred_tasks=[a, b],
            blocking_dag=blocking_dag,
            preferred_dag=_NO_PREFERRED,
            daily_loads={},
            capacity_vector=_FULL_CAP,
            start_date=_TODAY,
            ledger_writer=lambda *_: None,
            calendar_sync=lambda *_: None,
        )


def test_feathering_unplaceable_task_returns_none_date() -> None:
    """If all 14 days are full, the task gets scheduled_date=None and was_deferred=True."""
    heavy_loads = {
        _TODAY + timedelta(days=i): VIABLE_THRESHOLD
        for i in range(1, LOOK_AHEAD_MAX_EXTENSION_DAYS + 1)
    }
    # Give it an original scheduled_date so was_deferred reflects a change
    task = _task("t1", scheduled_date=_TODAY - timedelta(days=1))
    results = run_feathering(
        deferred_tasks=[task],
        blocking_dag=_NO_BLOCKING,
        preferred_dag=_NO_PREFERRED,
        daily_loads=heavy_loads,
        capacity_vector=_FULL_CAP,
        start_date=_TODAY,
        ledger_writer=lambda *_: None,
        calendar_sync=lambda *_: None,
    )
    assert results[0].scheduled_date is None
    assert results[0].was_deferred is True
