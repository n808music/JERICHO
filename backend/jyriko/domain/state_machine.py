"""Task lifecycle state machine — PRD §3.2."""
from __future__ import annotations

from dataclasses import replace
from typing import Callable

from jyriko.domain.types import Task, TaskStatus

S = TaskStatus


class InvalidTransitionError(ValueError):
    def __init__(self, from_status: TaskStatus, to_status: TaskStatus) -> None:
        super().__init__(f"Invalid transition: {from_status.value!r} → {to_status.value!r}")
        self.from_status = from_status
        self.to_status = to_status


VALID_TRANSITIONS: frozenset[tuple[TaskStatus, TaskStatus]] = frozenset({
    (S.CREATED, S.SCHEDULED),
    (S.SCHEDULED, S.IN_WINDOW),
    (S.IN_WINDOW, S.COMPLETED),
    (S.IN_WINDOW, S.MISSED),
    (S.MISSED, S.RESCHEDULED),
    (S.SCHEDULED, S.RESCHEDULED),
    (S.RESCHEDULED, S.SCHEDULED),
    (S.RESCHEDULED, S.IN_WINDOW),
    (S.SCHEDULED, S.VIABILITY_PAUSE),
    (S.IN_WINDOW, S.VIABILITY_PAUSE),
    (S.RESCHEDULED, S.VIABILITY_PAUSE),
    (S.VIABILITY_PAUSE, S.SCHEDULED),
    (S.VIABILITY_PAUSE, S.DECOMPOSED),
    (S.VIABILITY_PAUSE, S.DATE_EXTENDED),
    (S.VIABILITY_PAUSE, S.ARCHIVED),
    (S.SCHEDULED, S.DATE_EXTENDED),
    (S.DATE_EXTENDED, S.SCHEDULED),
    (S.SCHEDULED, S.DECOMPOSED),
    (S.COMPLETED, S.ARCHIVED),
    (S.MISSED, S.ARCHIVED),
    (S.DECOMPOSED, S.ARCHIVED),
})


def transition(
    task: Task,
    to_status: TaskStatus,
    ledger_writer: Callable[[Task, TaskStatus], None],
) -> Task:
    """Return updated Task after validating transition; call ledger_writer as side effect."""
    if (task.status, to_status) not in VALID_TRANSITIONS:
        raise InvalidTransitionError(task.status, to_status)
    updated = replace(task, status=to_status)
    ledger_writer(task, to_status)
    return updated
