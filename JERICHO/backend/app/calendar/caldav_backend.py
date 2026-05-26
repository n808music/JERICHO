"""
CalDAV backend.

VEVENT UID is set to task.id — reliable correlation without storing
a separate external_event_id. X-JERICHO-TASK-ID carries the same value
for integrations that parse raw iCalendar data (e.g., native iOS client).
Events are all-day (DATE not DATETIME) — JERICHO schedules at day granularity.
"""
from __future__ import annotations

from datetime import date, timedelta

import caldav  # type: ignore[import-untyped]
from caldav import DAVClient  # type: ignore[import-untyped]

from app.calendar.types import CalendarTask

_VCALENDAR_TEMPLATE = """\
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Jericho//Jericho 2.0//EN
BEGIN:VEVENT
UID:{uid}
SUMMARY:{summary}
DTSTART;VALUE=DATE:{dtstart}
DTEND;VALUE=DATE:{dtend}
X-JERICHO-TASK-ID:{uid}
END:VEVENT
END:VCALENDAR"""


def _fallback_date() -> date:
    return date.today()


def _build_ical(task: CalendarTask) -> str:
    day = task.scheduled_date or _fallback_date()
    return _VCALENDAR_TEMPLATE.format(
        uid=task.id,
        summary=task.title,
        dtstart=day.strftime("%Y%m%d"),
        dtend=(day + timedelta(days=1)).strftime("%Y%m%d"),
    )


class CalDAVBackend:
    def __init__(self, url: str, username: str, password: str) -> None:
        self._client = DAVClient(url=url, username=username, password=password)

    def _calendar(self) -> caldav.Calendar:
        principal = self._client.principal()
        calendars = principal.calendars()
        if not calendars:
            raise RuntimeError("No calendars found for CalDAV account")
        return calendars[0]

    async def create_event(self, task: CalendarTask) -> str:
        """Add a VEVENT and return task.id as external_event_id."""
        self._calendar().save_event(_build_ical(task))
        return task.id

    async def update_event(self, task: CalendarTask, external_event_id: str) -> None:
        """Overwrite event by UID; recreate if externally deleted."""
        cal = self._calendar()
        results = cal.search(uid=external_event_id, event=True)
        if not results:
            cal.save_event(_build_ical(task))
            return
        event = results[0]
        event.data = _build_ical(task)
        event.save()

    async def delete_event(self, external_event_id: str) -> None:
        """Delete event by UID; silently succeeds if already gone."""
        results = self._calendar().search(uid=external_event_id, event=True)
        if results:
            results[0].delete()
