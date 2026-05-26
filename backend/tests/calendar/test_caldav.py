"""Tests for CalDAVBackend — caldav.DAVClient mocked."""
from __future__ import annotations

from datetime import date
from unittest.mock import MagicMock, patch

import pytest

from jyriko.calendar.caldav import CalDAVBackend
from jyriko.domain.types import Task, TaskStatus


def _make_task(task_id: str = "task-002") -> Task:
    return Task(
        id=task_id,
        goal_id="goal-1",
        title="Run pipeline",
        status=TaskStatus.SCHEDULED,
        task_type="execution",
        importance_tier="routine",
        estimated_duration_minutes=30,
        cognitive_load=0.3,
        deferral_count=0,
        dependencies=(),
        scheduled_date=date(2026, 4, 2),
    )


def _make_backend() -> tuple[CalDAVBackend, MagicMock, MagicMock]:
    """Return (backend, mock_client, mock_calendar)."""
    mock_calendar = MagicMock()
    mock_principal = MagicMock()
    mock_principal.calendars.return_value = [mock_calendar]
    mock_client = MagicMock()
    mock_client.principal.return_value = mock_principal

    with patch("jyriko.calendar.caldav.DAVClient", return_value=mock_client):
        backend = CalDAVBackend(url="https://caldav.example.com", username="u", password="p")

    return backend, mock_client, mock_calendar


@pytest.mark.asyncio
async def test_create_event_sets_x_jericho_tag() -> None:
    backend, _, mock_calendar = _make_backend()
    task = _make_task()

    event_id = await backend.create_event(task)

    mock_calendar.save_event.assert_called_once()
    ical_data: str = mock_calendar.save_event.call_args.args[0]
    assert f"X-JERICHO-TASK-ID:{task.id}" in ical_data
    assert f"UID:{task.id}" in ical_data
    assert event_id == task.id


@pytest.mark.asyncio
async def test_create_event_returns_task_id_as_external_id() -> None:
    backend, _, _ = _make_backend()
    task = _make_task("my-task-id")
    assert await backend.create_event(task) == "my-task-id"


@pytest.mark.asyncio
async def test_update_event_patches_existing() -> None:
    backend, _, mock_calendar = _make_backend()
    task = _make_task()

    mock_event = MagicMock()
    mock_calendar.search.return_value = [mock_event]

    await backend.update_event(task, task.id)

    # Must set .data and call .save(), not save_event() again
    assert mock_event.data is not None
    mock_event.save.assert_called_once()
    mock_calendar.save_event.assert_not_called()


@pytest.mark.asyncio
async def test_update_event_recreates_when_not_found() -> None:
    """If the event was deleted externally, update should recreate it."""
    backend, _, mock_calendar = _make_backend()
    task = _make_task()

    mock_calendar.search.return_value = []
    await backend.update_event(task, task.id)

    mock_calendar.save_event.assert_called_once()


@pytest.mark.asyncio
async def test_delete_event_removes_found_event() -> None:
    backend, _, mock_calendar = _make_backend()
    mock_event = MagicMock()
    mock_calendar.search.return_value = [mock_event]

    await backend.delete_event("task-002")

    mock_event.delete.assert_called_once()


@pytest.mark.asyncio
async def test_delete_event_silent_when_not_found() -> None:
    """Already-deleted event should not raise."""
    backend, _, mock_calendar = _make_backend()
    mock_calendar.search.return_value = []

    await backend.delete_event("nonexistent")  # Must not raise
