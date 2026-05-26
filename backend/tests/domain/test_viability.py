"""Tests for domain/viability.py — PRD §3.2 boundary conditions."""
from datetime import date

import pytest

from jyriko.domain.types import Task, TaskStatus
from jyriko.domain.viability import check_viability, compute_load_ratio, should_trigger_viability_pause


# ── Fixtures ──────────────────────────────────────────────────────────────────

def _task(deferral_count: int, deadline: date | None = None) -> Task:
    return Task(
        id="t1",
        goal_id="g1",
        title="Test task",
        status=TaskStatus.SCHEDULED,
        task_type="execution",
        importance_tier="routine",
        estimated_duration_minutes=30,
        cognitive_load=0.5,
        deferral_count=deferral_count,
        dependencies=(),
        deadline=deadline,
    )


# ── compute_load_ratio ────────────────────────────────────────────────────────

def test_load_ratio_normal():
    assert compute_load_ratio(3.0, 4.0) == pytest.approx(0.75)


def test_load_ratio_zero_capacity_returns_inf():
    assert compute_load_ratio(1.0, 0.0) == float("inf")


def test_load_ratio_zero_load():
    assert compute_load_ratio(0.0, 4.0) == pytest.approx(0.0)


# ── check_viability ───────────────────────────────────────────────────────────

def test_viability_below_threshold():
    assert check_viability(0.50) == "viable"


def test_viability_at_lower_boundary():
    # Exactly at VIABLE_THRESHOLD (0.75) → overloaded
    assert check_viability(0.75) == "overloaded"


def test_viability_between_thresholds():
    assert check_viability(0.90) == "overloaded"


def test_viability_at_upper_boundary():
    # Exactly at OVERLOADED_THRESHOLD (1.0) → overloaded (not infeasible)
    assert check_viability(1.0) == "overloaded"


def test_viability_above_upper_boundary():
    assert check_viability(1.01) == "infeasible"


def test_viability_inf_is_infeasible():
    assert check_viability(float("inf")) == "infeasible"


# ── should_trigger_viability_pause ────────────────────────────────────────────

def test_no_trigger_below_deferral_threshold():
    triggered, urgency = should_trigger_viability_pause(_task(2), None)
    assert triggered is False
    assert urgency is None


def test_low_urgency_three_deferrals_no_deadline():
    triggered, urgency = should_trigger_viability_pause(_task(3), None)
    assert triggered is True
    assert urgency == "low"


def test_no_trigger_three_deferrals_with_far_deadline():
    # 3 deferrals but has a deadline far away — not the no-deadline rule
    triggered, urgency = should_trigger_viability_pause(_task(3, date(2030, 1, 1)), 100)
    assert triggered is False


def test_high_urgency_two_deferrals_deadline_within_seven_days():
    triggered, urgency = should_trigger_viability_pause(_task(2, date(2026, 3, 28)), 5)
    assert triggered is True
    assert urgency == "high"


def test_no_trigger_two_deferrals_deadline_at_boundary():
    # Exactly 7 days — triggers (≤ 7)
    triggered, urgency = should_trigger_viability_pause(_task(2, date(2026, 3, 29)), 7)
    assert triggered is True
    assert urgency == "high"


def test_high_urgency_five_deferrals_overrides_all():
    # 5 deferrals with no deadline → still high urgency
    triggered, urgency = should_trigger_viability_pause(_task(5), None)
    assert triggered is True
    assert urgency == "high"


def test_high_urgency_five_deferrals_with_far_deadline():
    # 5 deferrals with far deadline → high urgency (deferral-high rule wins)
    triggered, urgency = should_trigger_viability_pause(_task(5, date(2030, 1, 1)), 200)
    assert triggered is True
    assert urgency == "high"
