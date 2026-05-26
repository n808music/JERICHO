"""
TDD: tests for domain/sync.py — OQ-07 source-wins-by-last_updated conflict resolution.

The pure resolve_identity_rows() function compares incoming iOS rows against
the server's current rows and returns which rows need to be upserted.
"""
from __future__ import annotations

from datetime import datetime, timezone

import pytest

from jyriko.domain.sync import IdentitySyncRow, resolve_identity_rows


def _row(
    day_of_week: int,
    declared_capacity: float,
    last_updated: str,
    week_number: int = 4,
) -> IdentitySyncRow:
    return IdentitySyncRow(
        day_of_week=day_of_week,
        declared_capacity=declared_capacity,
        derived_capacity=declared_capacity * 0.95,
        week_number=week_number,
        last_updated=datetime.fromisoformat(last_updated.replace("Z", "+00:00")),
    )


# ---------------------------------------------------------------------------
# Basic conflict cases
# ---------------------------------------------------------------------------

def test_newer_incoming_row_wins() -> None:
    incoming = [_row(0, 0.85, "2026-03-22T10:00:00Z")]
    existing = [_row(0, 0.70, "2026-03-20T08:00:00Z")]

    to_upsert, skipped = resolve_identity_rows(incoming, existing)

    assert len(to_upsert) == 1
    assert to_upsert[0].declared_capacity == pytest.approx(0.85)
    assert skipped == 0


def test_older_incoming_row_skipped() -> None:
    incoming = [_row(1, 0.60, "2026-03-20T06:00:00Z")]
    existing = [_row(1, 0.90, "2026-03-22T12:00:00Z")]

    to_upsert, skipped = resolve_identity_rows(incoming, existing)

    assert len(to_upsert) == 0
    assert skipped == 1


def test_equal_timestamp_server_wins() -> None:
    """Same timestamp → idempotent: skip (server row retained)."""
    ts = "2026-03-22T10:00:00Z"
    incoming = [_row(2, 0.80, ts)]
    existing = [_row(2, 0.80, ts)]

    to_upsert, skipped = resolve_identity_rows(incoming, existing)

    assert len(to_upsert) == 0
    assert skipped == 1


def test_no_existing_row_always_upserted() -> None:
    incoming = [_row(3, 0.75, "2026-03-22T10:00:00Z")]
    existing: list[IdentitySyncRow] = []

    to_upsert, skipped = resolve_identity_rows(incoming, existing)

    assert len(to_upsert) == 1
    assert skipped == 0


# ---------------------------------------------------------------------------
# Batch behaviour
# ---------------------------------------------------------------------------

def test_mixed_batch_partial_sync() -> None:
    incoming = [
        _row(0, 0.85, "2026-03-22T10:00:00Z"),  # newer → sync
        _row(1, 0.60, "2026-03-20T06:00:00Z"),  # older → skip
        _row(2, 0.75, "2026-03-22T10:00:00Z"),  # no server row → sync
    ]
    existing = [
        _row(0, 0.70, "2026-03-20T08:00:00Z"),
        _row(1, 0.90, "2026-03-22T12:00:00Z"),
    ]

    to_upsert, skipped = resolve_identity_rows(incoming, existing)

    assert len(to_upsert) == 2  # day 0 + day 2
    assert skipped == 1          # day 1


def test_empty_incoming_returns_empty() -> None:
    to_upsert, skipped = resolve_identity_rows([], [_row(0, 0.8, "2026-03-22T10:00:00Z")])
    assert to_upsert == []
    assert skipped == 0


def test_empty_both_returns_empty() -> None:
    to_upsert, skipped = resolve_identity_rows([], [])
    assert to_upsert == []
    assert skipped == 0


# ---------------------------------------------------------------------------
# IdentitySyncRow is a frozen dataclass (immutable)
# ---------------------------------------------------------------------------

def test_identity_sync_row_is_frozen() -> None:
    row = _row(0, 0.8, "2026-03-22T10:00:00Z")
    with pytest.raises((AttributeError, TypeError)):
        row.declared_capacity = 0.9  # type: ignore[misc]


def test_resolve_preserves_all_row_fields() -> None:
    incoming = [_row(4, 0.77, "2026-03-22T10:00:00Z")]
    to_upsert, _ = resolve_identity_rows(incoming, [])
    result = to_upsert[0]
    assert result.day_of_week == 4
    assert result.declared_capacity == pytest.approx(0.77)
    assert result.derived_capacity == pytest.approx(0.77 * 0.95)
    assert result.week_number == 4
