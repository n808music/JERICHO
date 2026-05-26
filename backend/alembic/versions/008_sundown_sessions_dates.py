"""Add week_start and week_end DATE columns to sundown_sessions.

Revision ID: 008
Revises: 007
Create Date: 2026-03-22

PRD §4.6 specifies week_start DATE and week_end DATE. Migration 005
created week_number INT instead. This adds the correct columns without
dropping week_number (backwards-compatible; week_number kept for any
existing reads until a future cleanup migration).
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "008"
down_revision = "007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("sundown_sessions", sa.Column("week_start", sa.Date(), nullable=True))
    op.add_column("sundown_sessions", sa.Column("week_end", sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column("sundown_sessions", "week_end")
    op.drop_column("sundown_sessions", "week_start")
