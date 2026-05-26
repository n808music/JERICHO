"""005: sundown_sessions table for Saturday Sundown Reweave records.

Stores one row per completed Sundown session. Records the computed
completion_ratio, tone branch used, and the capacity_match response —
the capacity_match feeds the next reweave cycle's EWA calculation.
"""
from alembic import op

revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE sundown_sessions (
            id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            instance_id              UUID NOT NULL,
            week_number              INT NOT NULL,
            completion_ratio         FLOAT NOT NULL,
            tone_branch_used         VARCHAR(50) NOT NULL,
            momentum_signal          VARCHAR(20) NOT NULL,
            narrative_summary        TEXT,
            capacity_update_narrative TEXT,
            capacity_match           BOOLEAN,
            created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)

    op.execute("""
        CREATE INDEX ix_sundown_sessions_instance_id
            ON sundown_sessions (instance_id, created_at DESC)
    """)

    op.execute("ALTER TABLE sundown_sessions ENABLE ROW LEVEL SECURITY")

    op.execute("""
        CREATE POLICY instance_isolation ON sundown_sessions
            USING (instance_id = current_setting('app.instance_id', true)::uuid)
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS sundown_sessions CASCADE")
