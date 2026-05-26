"""001: Initial Jericho schema.

Creates all tables across three spaces:
  SELF/  — identity_state
  NOTES/ — goals, decision_ledger
  OPS/   — tasks, task_dependencies, calendar_sync_state,
            accountability_links, accountability_link_events,
            model_execution_log

Revision ID: 001_initial_schema
"""
from __future__ import annotations

from alembic import op

revision = "001_initial_schema"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Extensions ────────────────────────────────────────────────────────────
    op.execute('CREATE EXTENSION IF NOT EXISTS "pgcrypto"')

    # ── SELF/ space ───────────────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE identity_state (
            id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            instance_id           UUID NOT NULL,
            day_of_week           SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
            declared_capacity     FLOAT NOT NULL,
            derived_capacity      FLOAT,
            confidence_weight     FLOAT NOT NULL DEFAULT 1.0,
            task_type_corrections JSONB NOT NULL DEFAULT '{}',
            week_number           INT NOT NULL DEFAULT 1,
            update_source         VARCHAR(50) NOT NULL DEFAULT 'user',
            updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
            UNIQUE (instance_id, day_of_week)
        )
    """)

    # ── NOTES/ space ─────────────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE goals (
            id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            instance_id UUID NOT NULL,
            title       TEXT NOT NULL,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)

    op.execute("""
        CREATE TABLE decision_ledger (
            id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            instance_id        UUID NOT NULL,
            task_id            UUID,
            decision_type      VARCHAR(50) NOT NULL,
            from_date          DATE,
            to_date            DATE,
            reason_code        VARCHAR(50),
            load_ratio_source  FLOAT,
            load_ratio_dest    FLOAT,
            algorithm_version  VARCHAR(20) NOT NULL DEFAULT '2.0',
            created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)

    # ── OPS/ space ────────────────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE tasks (
            id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            instance_id                UUID NOT NULL,
            goal_id                    UUID REFERENCES goals(id),
            title                      TEXT NOT NULL,
            status                     VARCHAR(30) NOT NULL
                CHECK (status IN (
                    'created','scheduled','in_window','completed',
                    'missed','rescheduled','viability_pause',
                    'decomposed','date_extended','archived'
                )),
            task_type                  VARCHAR(30) NOT NULL,
            importance_tier            VARCHAR(30) NOT NULL,
            estimated_duration_minutes INT NOT NULL,
            cognitive_load             FLOAT NOT NULL DEFAULT 0.5,
            deferral_count             INT NOT NULL DEFAULT 0,
            scheduled_date             DATE,
            deadline                   DATE,
            created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)

    op.execute("""
        CREATE TABLE task_dependencies (
            id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            task_id            UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
            depends_on_task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
            dependency_type    VARCHAR(30) NOT NULL
                CHECK (dependency_type IN ('blocking','preferred_order','parallel_ok')),
            UNIQUE (task_id, depends_on_task_id)
        )
    """)

    op.execute("""
        CREATE TABLE calendar_sync_state (
            id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            instance_id       UUID NOT NULL,
            task_id           UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
            external_event_id VARCHAR(255) NOT NULL,
            calendar_type     VARCHAR(20) NOT NULL CHECK (calendar_type IN ('google','caldav')),
            synced_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
            UNIQUE (task_id, calendar_type)
        )
    """)

    op.execute("""
        CREATE TABLE accountability_links (
            id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            owner_instance_id  UUID NOT NULL,
            viewer_instance_id UUID,
            token              VARCHAR(100) NOT NULL UNIQUE,
            scope              VARCHAR(50) NOT NULL DEFAULT 'summary_only',
            created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
            revoked_at         TIMESTAMPTZ
        )
    """)

    op.execute("""
        CREATE TABLE accountability_link_events (
            id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            link_id    UUID NOT NULL REFERENCES accountability_links(id),
            event_type VARCHAR(50) NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)

    op.execute("""
        CREATE TABLE model_execution_log (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            instance_id     UUID NOT NULL,
            model_id        VARCHAR(100) NOT NULL,
            operation       VARCHAR(100) NOT NULL,
            pass_number     INT NOT NULL DEFAULT 1,
            tokens_used     INT,
            latency_seconds FLOAT,
            success         BOOLEAN NOT NULL DEFAULT true,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)

    # ── Indexes for common query patterns ─────────────────────────────────────
    op.execute("CREATE INDEX idx_tasks_instance_status ON tasks (instance_id, status)")
    op.execute("CREATE INDEX idx_tasks_scheduled_date ON tasks (instance_id, scheduled_date)")
    op.execute("CREATE INDEX idx_decision_ledger_task ON decision_ledger (task_id)")
    op.execute("CREATE INDEX idx_model_log_model ON model_execution_log (model_id, created_at)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS model_execution_log CASCADE")
    op.execute("DROP TABLE IF EXISTS accountability_link_events CASCADE")
    op.execute("DROP TABLE IF EXISTS accountability_links CASCADE")
    op.execute("DROP TABLE IF EXISTS calendar_sync_state CASCADE")
    op.execute("DROP TABLE IF EXISTS task_dependencies CASCADE")
    op.execute("DROP TABLE IF EXISTS tasks CASCADE")
    op.execute("DROP TABLE IF EXISTS decision_ledger CASCADE")
    op.execute("DROP TABLE IF EXISTS goals CASCADE")
    op.execute("DROP TABLE IF EXISTS identity_state CASCADE")
