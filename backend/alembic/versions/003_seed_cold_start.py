"""003: Cold-start seeding function.

Creates the Postgres function `seed_cold_start_identity(p_instance_id, p_declared_capacity)`
that initialises identity_state rows for a brand-new user.

Called by the onboarding endpoint (POST /identity/onboard) at registration,
not by the migration itself — the migration only installs the function.

Revision ID: 003_seed_cold_start
"""
from __future__ import annotations

from alembic import op

revision = "003_seed_cold_start"
down_revision = "002_rls_policies"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Install a stored function so onboarding has a single atomic operation.
    # The function inserts 7 identity_state rows (one per day of week) with
    # declared_capacity scaled by the week-1 cold-start multiplier (0.60).
    # Callers are responsible for incrementing week_number on each Sundown cycle.
    op.execute("""
        CREATE OR REPLACE FUNCTION seed_cold_start_identity(
            p_instance_id      UUID,
            p_declared_capacity FLOAT
        ) RETURNS VOID
        LANGUAGE plpgsql
        AS $$
        DECLARE
            _day SMALLINT;
            _cold_start_mult FLOAT := 0.60;  -- week 1 multiplier (matches Python constant)
        BEGIN
            FOR _day IN 0..6 LOOP
                INSERT INTO identity_state (
                    instance_id,
                    day_of_week,
                    declared_capacity,
                    derived_capacity,
                    confidence_weight,
                    task_type_corrections,
                    week_number,
                    update_source
                ) VALUES (
                    p_instance_id,
                    _day,
                    p_declared_capacity * _cold_start_mult,
                    NULL,
                    1.0,
                    '{}',
                    1,
                    'cold_start'
                )
                ON CONFLICT (instance_id, day_of_week) DO NOTHING;
            END LOOP;
        END;
        $$
    """)


def downgrade() -> None:
    op.execute("DROP FUNCTION IF EXISTS seed_cold_start_identity(UUID, FLOAT)")
