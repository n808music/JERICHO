"""OPS/ space: model_execution_log for OTEL span persistence + registry refinement.

Revision ID: 007
Revises: 006
Create Date: 2026-03-22

Stores per-LLM-call telemetry (latency, token counts, validation status).
Feeds OQ-08 registry drift detection: when observed latency diverges from
the registry entry's timeout_threshold_seconds, the entry is flagged.
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "007"
down_revision = "006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "model_execution_log",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("instance_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("model_id", sa.String(100)),
        sa.Column("operation_type", sa.String(50)),
        sa.Column("pass_number", sa.SmallInteger()),
        sa.Column("prompt_tokens", sa.Integer()),
        sa.Column("completion_tokens", sa.Integer()),
        sa.Column("latency_ms", sa.Integer()),
        sa.Column("validation_passed", sa.Boolean()),
        sa.Column("error_detail", sa.Text()),
        sa.Column("otel_trace_id", sa.String(64)),
        sa.Column(
            "timestamp",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
        ),
    )


def downgrade() -> None:
    op.drop_table("model_execution_log")
