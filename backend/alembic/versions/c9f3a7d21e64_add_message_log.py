"""add message_log (WhatsApp/SMS delivery audit)

Revision ID: c9f3a7d21e64
Revises: b8e2c4a1f739
Create Date: 2026-07-03
"""
import sqlalchemy as sa
from alembic import op

revision = "c9f3a7d21e64"
down_revision = "b8e2c4a1f739"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "message_log",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("channel", sa.String(length=20), nullable=False, server_default="whatsapp"),
        sa.Column("provider", sa.String(length=20), nullable=True),
        sa.Column("to_number", sa.String(length=32), nullable=False),
        sa.Column("template", sa.String(length=60), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="queued"),
        sa.Column("provider_message_id", sa.String(length=120), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("message_log")
