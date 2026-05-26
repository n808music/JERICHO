"""Tests for GoogleCalendarBackend — googleapiclient mocked."""
from __future__ import annotations

from datetime import date
from unittest.mock import MagicMock, patch

import pytest
from googleapiclient.errors import HttpError

from app.calendar.google_backend import GoogleCalendarBackend
from app.calendar.types import CalendarTask


@pytest.fixture
def mock_service():
    svc = MagicMock()
    svc.events.return_value.insert.return_value.execute.return_value = {"id": "gcal-event-id"}
    svc.events.return_value.patch.return_value.execute.return_value = {}
    svc.events.return_value.delete.return_value.execute.return_value = {}
    return svc


@pytest.fixture
def backend(mock_service):
    with patch("app.calendar.google_backend._build_service", return_value=mock_service):
        b = GoogleCalendarBackend(credentials=MagicMock())
        b._service = mock_service
        yield b


@pytest.fixture
def task():
    return CalendarTask(id="task-1", title="Ship feature", scheduled_date=date(2026, 6, 1))


@pytest.mark.asyncio
async def test_create_event_returns_event_id(backend, mock_service, task):
    result = await backend.create_event(task)
    assert result == "gcal-event-id"
    mock_service.events.return_value.insert.assert_called_once()
    body = mock_service.events.return_value.insert.call_args.kwargs["body"]
    assert body["summary"] == "Ship feature"
    assert body["extendedProperties"]["private"]["jericho_task_id"] == "task-1"


@pytest.mark.asyncio
async def test_update_event_patches(backend, mock_service, task):
    await backend.update_event(task, "gcal-event-id")
    mock_service.events.return_value.patch.assert_called_once()
    call = mock_service.events.return_value.patch.call_args
    assert call.kwargs["eventId"] == "gcal-event-id"
    assert call.kwargs["body"]["summary"] == "Ship feature"


@pytest.mark.asyncio
async def test_delete_event(backend, mock_service):
    await backend.delete_event("gcal-event-id")
    mock_service.events.return_value.delete.assert_called_once_with(
        calendarId="primary", eventId="gcal-event-id"
    )


@pytest.mark.asyncio
async def test_delete_event_410_is_noop(backend, mock_service):
    resp = MagicMock()
    resp.status = 410
    mock_service.events.return_value.delete.return_value.execute.side_effect = HttpError(
        resp=resp, content=b"Gone"
    )
    await backend.delete_event("already-gone")  # must not raise


@pytest.mark.asyncio
async def test_delete_event_non_410_reraises(backend, mock_service):
    resp = MagicMock()
    resp.status = 403
    mock_service.events.return_value.delete.return_value.execute.side_effect = HttpError(
        resp=resp, content=b"Forbidden"
    )
    with pytest.raises(HttpError):
        await backend.delete_event("forbidden-event")
