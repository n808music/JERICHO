from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Optional


@dataclass
class CalendarTask:
    """Minimal task representation used by calendar backends."""
    id: str
    title: str
    scheduled_date: Optional[date] = None
