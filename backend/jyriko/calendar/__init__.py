"""
Calendar integration package.

CalendarBackend is a structural Protocol — both GoogleCalendarBackend and
CalDAVBackend implement it without inheriting from it, enabling easy
substitution and testing with plain mock objects.
"""
from __future__ import annotations

from typing import Protocol, runtime_checkable

from jyriko.domain.types import Task


@runtime_checkable
class CalendarBackend(Protocol):
    """Write-only calendar integration contract."""

    async def create_event(self, task: Task) -> str:
        """Create a calendar event for *task*. Returns external_event_id."""
        ...

    async def update_event(self, task: Task, external_event_id: str) -> None:
        """Patch an existing event to reflect current *task* state."""
        ...

    async def delete_event(self, external_event_id: str) -> None:
        """Remove a calendar event by its external_event_id."""
        ...
