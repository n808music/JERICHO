"""
OQ-07: source-wins-by-last_updated conflict resolution for identity_state sync.

When an iOS client syncs local identity_state rows back to the server, each
incoming row is compared to the server's copy by last_updated timestamp.
The row with the newer timestamp wins; ties go to the server (idempotent).
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any


@dataclass(frozen=True)
class IdentitySyncRow:
    day_of_week: int
    declared_capacity: float
    derived_capacity: float
    week_number: int
    last_updated: datetime


def resolve_identity_rows(
    incoming: list[IdentitySyncRow],
    existing: list[IdentitySyncRow],
) -> tuple[list[IdentitySyncRow], int]:
    """Return (rows_to_upsert, skipped_count) per source-wins-by-last_updated.

    Rules:
    - incoming.last_updated > existing.last_updated → incoming wins → upsert
    - incoming.last_updated <= existing.last_updated → server wins → skip
    - No matching existing row → always upsert
    """
    existing_by_day: dict[int, IdentitySyncRow] = {r.day_of_week: r for r in existing}

    to_upsert: list[IdentitySyncRow] = []
    skipped = 0

    for row in incoming:
        server = existing_by_day.get(row.day_of_week)
        if server is None or row.last_updated > server.last_updated:
            to_upsert.append(row)
        else:
            skipped += 1

    return to_upsert, skipped
