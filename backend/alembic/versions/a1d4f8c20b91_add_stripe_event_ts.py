"""add users.stripe_event_ts (webhook event ordering/idempotency)

Revision ID: a1d4f8c20b91
Revises: f1c3d7a92b60
Create Date: 2026-11-09
"""
import sqlalchemy as sa
from alembic import op

revision = "a1d4f8c20b91"
down_revision = "f1c3d7a92b60"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("stripe_event_ts", sa.BigInteger(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "stripe_event_ts")
