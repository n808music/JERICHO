"""OQ-07: add last_updated to identity_state for source-wins iOS sync.

Revision ID: 006
Revises: 005
Create Date: 2026-03-22

Adds a last_updated TIMESTAMPTZ column (defaulting to now()) so that iOS
clients and the server can resolve conflicts by comparing timestamps.
The touch_updated_at trigger keeps the column current on every UPDATE.
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "006"
down_revision = "005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add last_updated column — defaults to now() so existing rows get a
    # timestamp without requiring a backfill.
    op.add_column(
        "identity_state",
        sa.Column(
            "last_updated",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )

    # Trigger: keep last_updated fresh on every UPDATE
    op.execute("""
        CREATE OR REPLACE FUNCTION touch_identity_state_last_updated()
        RETURNS TRIGGER LANGUAGE plpgsql AS $$
        BEGIN
            NEW.last_updated = now();
            RETURN NEW;
        END;
        $$;
    """)

    op.execute("""
        DROP TRIGGER IF EXISTS trg_identity_state_last_updated ON identity_state;
        CREATE TRIGGER trg_identity_state_last_updated
            BEFORE UPDATE ON identity_state
            FOR EACH ROW EXECUTE FUNCTION touch_identity_state_last_updated();
    """)

    # native_notifications table for the Tauri system tray notification queue
    op.execute("""
        CREATE TABLE IF NOT EXISTS native_notifications (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            instance_id     UUID NOT NULL,
            title           TEXT NOT NULL,
            body            TEXT NOT NULL DEFAULT '',
            delivered_at    TIMESTAMPTZ,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
        );
    """)

    op.execute("""
        ALTER TABLE native_notifications ENABLE ROW LEVEL SECURITY;
        CREATE POLICY instance_isolation ON native_notifications
            USING (instance_id = current_setting('app.instance_id', true)::uuid);
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS native_notifications;")
    op.execute(
        "DROP TRIGGER IF EXISTS trg_identity_state_last_updated ON identity_state;"
    )
    op.execute(
        "DROP FUNCTION IF EXISTS touch_identity_state_last_updated();"
    )
    op.drop_column("identity_state", "last_updated")
