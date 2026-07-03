"""add public profile fields (street_address, opening_hours)

Revision ID: f2d4b8e1a690
Revises: e5c1a7f9d380
Create Date: 2026-07-03
"""
import sqlalchemy as sa
from alembic import op

revision = "f2d4b8e1a690"
down_revision = "e5c1a7f9d380"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("street_address", sa.String(250), nullable=True))
    op.add_column("users", sa.Column("opening_hours", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "opening_hours")
    op.drop_column("users", "street_address")
