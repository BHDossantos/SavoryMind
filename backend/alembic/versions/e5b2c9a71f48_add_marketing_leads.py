"""add marketing_leads (public calculator lead capture)

Revision ID: e5b2c9a71f48
Revises: d4a1b6e28c37
Create Date: 2026-08-19
"""
import sqlalchemy as sa
from alembic import op

revision = "e5b2c9a71f48"
down_revision = "d4a1b6e28c37"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "marketing_leads",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("email", sa.String(length=255), nullable=False, index=True),
        sa.Column("restaurant_name", sa.String(length=200), nullable=True),
        sa.Column("source", sa.String(length=40), nullable=False, server_default="calcolatore"),
        sa.Column("profile", sa.JSON(), nullable=True),
        sa.Column("band_low", sa.Float(), nullable=True),
        sa.Column("band_high", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True, index=True),
    )


def downgrade() -> None:
    op.drop_table("marketing_leads")
