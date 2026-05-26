"""
Google Calendar backend.

Ownership tagging: every created event carries
`extendedProperties.private.jericho_task_id` so we can reliably identify
events that belong to Jericho regardless of title changes.

Uses `events().patch()` (not `update()`) for partial updates — avoids
clobbering user-added fields like descriptions, attendees, or colour.
"""
from __future__ import annotations

from typing import Any

from googleapiclient.discovery import Resource, build  # type: ignore[import-untyped]
from googleapiclient.errors import HttpError  # type: ignore[import-untyped]

from jyriko.domain.types import Task

_CALENDAR_ID = "primary"
_JERICHO_TAG_KEY = "jericho_task_id"


def _build_service(credentials: Any) -> Resource:
    return build("calendar", "v3", credentials=credentials, cache_discovery=False)


def _event_body(task: Task, *, include_tag: bool = True) -> dict[str, Any]:
    body: dict[str, Any] = {
        "summary": task.title,
        "start": {"date": task.scheduled_date.isoformat() if task.scheduled_date else None},
        "end": {"date": task.scheduled_date.isoformat() if task.scheduled_date else None},
    }
    if include_tag:
        body["extendedProperties"] = {"private": {_JERICHO_TAG_KEY: task.id}}
    return body


class GoogleCalendarBackend:
    """Async-compatible Google Calendar backend (wraps sync googleapiclient)."""

    def __init__(self, credentials: Any) -> None:
        self._service: Resource = _build_service(credentials)

    async def create_event(self, task: Task) -> str:
        """Insert a new calendar event and return its Google event id."""
        result: dict[str, Any] = (
            self._service.events()
            .insert(calendarId=_CALENDAR_ID, body=_event_body(task, include_tag=True))
            .execute()
        )
        return result["id"]

    async def update_event(self, task: Task, external_event_id: str) -> None:
        """Patch an existing event — updates summary and dates only."""
        patch_body: dict[str, Any] = {
            "summary": task.title,
            "start": {"date": task.scheduled_date.isoformat() if task.scheduled_date else None},
            "end": {"date": task.scheduled_date.isoformat() if task.scheduled_date else None},
        }
        self._service.events().patch(
            calendarId=_CALENDAR_ID, eventId=external_event_id, body=patch_body
        ).execute()

    async def delete_event(self, external_event_id: str) -> None:
        """Delete a calendar event; 410 Gone treated as success."""
        try:
            self._service.events().delete(
                calendarId=_CALENDAR_ID, eventId=external_event_id
            ).execute()
        except HttpError as exc:
            if exc.resp.status == 410:
                return
            raise
