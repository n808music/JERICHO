"""Tests for CalDAVBackend — caldav.DAVClient mocked."""
from __future__ import annotations

from datetime import date
from unittest.mock import MagicMock, patch

import pytest

from app.calendar.caldav_backend import CalDAVBackend
from app.calendar.types import CalendarTask


@pytest.fixture
def mock_calendar():
    cal = MagicMock()
    cal.search.return_value = []
    return cal


@pytest.fixture
def backend(mock_calendar):
    with patch("app.calendar.caldav_backend.DAVClient") as mock_client_cls:
        instance = mock_client_cls.return_value
        instance.principal.return_value.calendars.return_value = [mock_calendar]
        b = CalDAVBackend(url="https://cal.example.com", username="u", password="p")
        b._mock_calendar = mock_calendar
        yield b


@pytest.fixture
def task():
    return CalendarTask(id="task-1", title="Write tests", scheduled_date=date(2026, 6, 1))


@pytest.mark.asyncio
async def test_create_event_returns_task_id(backend, task):
    result = await backend.create_event(task)
    assert result == "task-1"
    backend._mock_calendar.save_event.assert_called_once()
    ical = backend._mock_calendar.save_event.call_args[0][0]
    assert "task-1" in ical
    assert "Write tests" in ical
    assert "20260601" in ical


@pytest.mark.asyncio
async def test_update_event_overwrites_existing(backend, task):
    mock_event = MagicMock()
    backend._mock_calendar.search.return_value = [mock_event]

    await backend.update_event(task, "task-1")

    assert mock_event.data is not None
    mock_event.save.assert_called_once()


@pytest.mark.asyncio
async def test_update_event_recreates_if_missing(backend, task):
    backend._mock_calendar.search.return_value = []

    await backend.update_event(task, "task-1")

    backend._mock_calendar.save_event.assert_called_once()


@pytest.mark.asyncio
async def test_delete_event_found(backend):
    mock_event = MagicMock()
    backend._mock_calendar.search.return_value = [mock_event]

    await backend.delete_event("task-1")

    mock_event.delete.assert_called_once()


@pytest.mark.asyncio
async def test_delete_event_not_found_is_noop(backend):
    backend._mock_calendar.search.return_value = []
    await backend.delete_event("nonexistent")  # must not raise


@pytest.mark.asyncio
async def test_no_calendars_raises(task):
    with patch("app.calendar.caldav_backend.DAVClient") as mock_client_cls:
        instance = mock_client_cls.return_value
        instance.principal.return_value.calendars.return_value = []
        b = CalDAVBackend(url="https://cal.example.com", username="u", password="p")
        with pytest.raises(RuntimeError, match="No calendars found"):
            await b.create_event(task)
