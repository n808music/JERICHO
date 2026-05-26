"""Tests for domain/state_machine.py."""
from datetime import date, datetime, timezone

import pytest

from jyriko.domain.state_machine import (
    VALID_TRANSITIONS,
    InvalidTransitionError,
    transition,
)
from jyriko.domain.types import Task, TaskStatus


# ── Fixture ───────────────────────────────────────────────────────────────────

def _task(status: TaskStatus) -> Task:
    return Task(
        id="t1",
        goal_id="g1",
        title="Test task",
        status=status,
        task_type="execution",
        importance_tier="routine",
        estimated_duration_minutes=30,
        cognitive_load=0.5,
        deferral_count=0,
        dependencies=(),
    )


_NO_OP_LEDGER = lambda task, to_status: None


# ── VALID_TRANSITIONS structure ───────────────────────────────────────────────

def test_valid_transitions_is_frozenset():
    assert isinstance(VALID_TRANSITIONS, frozenset)


def test_created_to_scheduled_allowed():
    assert (TaskStatus.CREATED, TaskStatus.SCHEDULED) in VALID_TRANSITIONS


def test_completed_to_created_forbidden():
    assert (TaskStatus.COMPLETED, TaskStatus.CREATED) not in VALID_TRANSITIONS


# ── transition() happy paths ──────────────────────────────────────────────────

def test_valid_transition_returns_new_task():
    task = _task(TaskStatus.CREATED)
    updated = transition(task, TaskStatus.SCHEDULED, _NO_OP_LEDGER)
    assert updated.status == TaskStatus.SCHEDULED
    assert updated.id == task.id


def test_transition_does_not_mutate_original():
    task = _task(TaskStatus.CREATED)
    transition(task, TaskStatus.SCHEDULED, _NO_OP_LEDGER)
    assert task.status == TaskStatus.CREATED


def test_transition_calls_ledger_writer():
    calls: list[tuple] = []
    task = _task(TaskStatus.SCHEDULED)
    transition(task, TaskStatus.IN_WINDOW, lambda t, s: calls.append((t, s)))
    assert len(calls) == 1
    assert calls[0][1] == TaskStatus.IN_WINDOW


def test_in_window_to_completed():
    task = _task(TaskStatus.IN_WINDOW)
    updated = transition(task, TaskStatus.COMPLETED, _NO_OP_LEDGER)
    assert updated.status == TaskStatus.COMPLETED


def test_viability_pause_from_scheduled():
    task = _task(TaskStatus.SCHEDULED)
    updated = transition(task, TaskStatus.VIABILITY_PAUSE, _NO_OP_LEDGER)
    assert updated.status == TaskStatus.VIABILITY_PAUSE


def test_viability_pause_to_decomposed():
    task = _task(TaskStatus.VIABILITY_PAUSE)
    updated = transition(task, TaskStatus.DECOMPOSED, _NO_OP_LEDGER)
    assert updated.status == TaskStatus.DECOMPOSED


# ── transition() error paths ──────────────────────────────────────────────────

def test_invalid_transition_raises():
    task = _task(TaskStatus.COMPLETED)
    with pytest.raises(InvalidTransitionError):
        transition(task, TaskStatus.CREATED, _NO_OP_LEDGER)


def test_invalid_transition_error_contains_statuses():
    task = _task(TaskStatus.ARCHIVED)
    with pytest.raises(InvalidTransitionError) as exc_info:
        transition(task, TaskStatus.SCHEDULED, _NO_OP_LEDGER)
    err = exc_info.value
    assert err.from_status == TaskStatus.ARCHIVED
    assert err.to_status == TaskStatus.SCHEDULED


def test_ledger_writer_not_called_on_invalid_transition():
    calls: list = []
    task = _task(TaskStatus.COMPLETED)
    with pytest.raises(InvalidTransitionError):
        transition(task, TaskStatus.CREATED, lambda t, s: calls.append(s))
    assert calls == []
