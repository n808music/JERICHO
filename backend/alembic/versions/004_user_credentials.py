"""004: user_credentials table for encrypted OAuth/CalDAV tokens.

Stores encrypted credential payloads per (instance_id, credential_type).
Encryption is AES-256-GCM applied in the application layer — Supabase only
sees opaque ciphertext. RLS restricts reads to the owning instance.
"""
from alembic import op

revision = "004"
down_revision = "003_seed_cold_start"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE user_credentials (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            instance_id     UUID NOT NULL,
            credential_type TEXT NOT NULL
                CHECK (credential_type IN ('google', 'caldav')),
            encrypted_payload JSONB NOT NULL DEFAULT '{}',
            created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
            UNIQUE (instance_id, credential_type)
        )
    """)

    op.execute("""
        CREATE INDEX ix_user_credentials_instance_id
            ON user_credentials (instance_id)
    """)

    # Auto-update updated_at on row modification
    op.execute("""
        CREATE OR REPLACE FUNCTION touch_updated_at()
        RETURNS TRIGGER LANGUAGE plpgsql AS $$
        BEGIN
            NEW.updated_at = now();
            RETURN NEW;
        END;
        $$
    """)

    op.execute("""
        CREATE TRIGGER user_credentials_updated_at
        BEFORE UPDATE ON user_credentials
        FOR EACH ROW EXECUTE FUNCTION touch_updated_at()
    """)

    # RLS — same instance_isolation pattern as all other SELF/ tables
    op.execute("ALTER TABLE user_credentials ENABLE ROW LEVEL SECURITY")

    op.execute("""
        CREATE POLICY instance_isolation ON user_credentials
            USING (instance_id = current_setting('app.instance_id', true)::uuid)
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS user_credentials CASCADE")
    op.execute("DROP FUNCTION IF EXISTS touch_updated_at() CASCADE")
