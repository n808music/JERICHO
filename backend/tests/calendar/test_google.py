"""Tests for GoogleCalendarBackend — googleapiclient mocked."""
from __future__ import annotations

from datetime import date
from unittest.mock import MagicMock, patch

import pytest

from jyriko.calendar.google import GoogleCalendarBackend, _JERICHO_TAG_KEY
from jyriko.domain.types import Task, TaskStatus


def _make_task(task_id: str = "task-001", scheduled_date: date | None = date(2026, 4, 1)) -> Task:
    return Task(
        id=task_id,
        goal_id="goal-1",
        title="Write tests",
        status=TaskStatus.SCHEDULED,
        task_type="execution",
        importance_tier="routine",
        estimated_duration_minutes=60,
        cognitive_load=0.4,
        deferral_count=0,
        dependencies=(),
        scheduled_date=scheduled_date,
    )


@pytest.fixture()
def mock_service() -> MagicMock:
    return MagicMock()


@pytest.fixture()
def backend(mock_service: MagicMock) -> GoogleCalendarBackend:
    with patch("jyriko.calendar.google._build_service", return_value=mock_service):
        return GoogleCalendarBackend(credentials=MagicMock())


@pytest.mark.asyncio
async def test_create_event_sets_ownership_tag(
    backend: GoogleCalendarBackend, mock_service: MagicMock
) -> None:
    task = _make_task()
    mock_service.events.return_value.insert.return_value.execute.return_value = {"id": "gcal-abc"}

    event_id = await backend.create_event(task)

    assert event_id == "gcal-abc"
    call_kwargs = mock_service.events.return_value.insert.call_args.kwargs
    body = call_kwargs["body"]
    assert body["extendedProperties"]["private"][_JERICHO_TAG_KEY] == task.id


@pytest.mark.asyncio
async def test_update_event_uses_patch_not_insert(
    backend: GoogleCalendarBackend, mock_service: MagicMock
) -> None:
    task = _make_task()
    await backend.update_event(task, "gcal-abc")

    # patch() called, insert() not called
    mock_service.events.return_value.patch.assert_called_once()
    mock_service.events.return_value.insert.assert_not_called()


@pytest.mark.asyncio
async def test_update_event_does_not_overwrite_ownership_tag(
    backend: GoogleCalendarBackend, mock_service: MagicMock
) -> None:
    """patch body must NOT include extendedProperties (avoids clobbering user data)."""
    task = _make_task()
    await backend.update_event(task, "gcal-abc")

    patch_kwargs = mock_service.events.return_value.patch.call_args.kwargs
    patch_body = patch_kwargs["body"]
    assert "extendedProperties" not in patch_body


@pytest.mark.asyncio
async def test_delete_event_calls_delete(
    backend: GoogleCalendarBackend, mock_service: MagicMock
) -> None:
    await backend.delete_event("gcal-abc")
    mock_service.events.return_value.delete.assert_called_once_with(
        calendarId="primary", eventId="gcal-abc"
    )


@pytest.mark.asyncio
async def test_delete_event_410_is_silent(
    backend: GoogleCalendarBackend, mock_service: MagicMock
) -> None:
    """410 Gone means already deleted — should not raise."""
    from googleapiclient.errors import HttpError

    resp = MagicMock()
    resp.status = 410
    mock_service.events.return_value.delete.return_value.execute.side_effect = HttpError(
        resp=resp, content=b"Gone"
    )
    # Must not raise
    await backend.delete_event("gcal-already-gone")
