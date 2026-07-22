"""add coaching engine v2 (staff fields, incidents, coaching_plans)

Revision ID: b8e2c4a1f739
Revises: b8e2c1f4a730
Create Date: 2026-07-03
"""
import sqlalchemy as sa
from alembic import op

revision = "b8e2c4a1f739"
down_revision = "b8e2c1f4a730"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("staff", sa.Column("hourly_cost", sa.Float(), nullable=True))
    op.add_column("staff", sa.Column("whatsapp_number", sa.String(length=32), nullable=True))
    op.add_column("staff", sa.Column("whatsapp_consent_at", sa.DateTime(), nullable=True))
    op.add_column("staff", sa.Column("language", sa.String(length=10), nullable=True))

    op.create_table(
        "incidents",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("staff_id", sa.Integer(), sa.ForeignKey("staff.id"), nullable=False, index=True),
        sa.Column("type", sa.String(length=20), nullable=False),
        sa.Column("occurred_at", sa.Date(), nullable=False),
        sa.Column("quantity", sa.Float(), nullable=True),
        sa.Column("unit", sa.String(length=20), nullable=True),
        sa.Column("euro_impact", sa.Float(), nullable=False, server_default="0"),
        sa.Column("cause_tags", sa.Text(), nullable=True),
        sa.Column("source", sa.String(length=20), nullable=False, server_default="manual"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
    )

    op.create_table(
        "coaching_plans",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("staff_id", sa.Integer(), sa.ForeignKey("staff.id"), nullable=False, index=True),
        sa.Column("period", sa.String(length=20), nullable=False),
        sa.Column("priority", sa.String(length=10), nullable=False, server_default="medium"),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("euro_impact_total", sa.Float(), nullable=False, server_default="0"),
        sa.Column("expected_recovery", sa.Float(), nullable=True),
        sa.Column("actions_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("language", sa.String(length=10), nullable=False, server_default="it"),
        sa.Column("status", sa.String(length=10), nullable=False, server_default="draft"),
        sa.Column("generated_by_model", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("reviewed_by_owner", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("delivered_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("coaching_plans")
    op.drop_table("incidents")
    op.drop_column("staff", "language")
    op.drop_column("staff", "whatsapp_consent_at")
    op.drop_column("staff", "whatsapp_number")
    op.drop_column("staff", "hourly_cost")
