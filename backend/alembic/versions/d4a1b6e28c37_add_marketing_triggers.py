"""add marketing_triggers (automation trigger log)

Revision ID: d4a1b6e28c37
Revises: c9f3a7d21e64
Create Date: 2026-07-03
"""
import sqlalchemy as sa
from alembic import op

revision = "d4a1b6e28c37"
down_revision = "c9f3a7d21e64"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "marketing_triggers",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("customer_id", sa.Integer(), sa.ForeignKey("crm_customers.id"), nullable=False, index=True),
        sa.Column("trigger_type", sa.String(length=30), nullable=False),
        sa.Column("period", sa.String(length=30), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="suggested"),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.UniqueConstraint("customer_id", "trigger_type", "period", name="uq_marketing_trigger"),
    )


def downgrade() -> None:
    op.drop_table("marketing_triggers")
