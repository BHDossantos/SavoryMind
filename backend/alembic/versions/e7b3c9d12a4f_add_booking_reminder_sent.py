"""add bookings.reminder_sent_at for diner reminders

Revision ID: e7b3c9d12a4f
Revises: d9f4a2e1b56c
Create Date: 2026-06-01 20:00:00.000000

Adds a timestamp column on bookings so the reminder scheduler can mark
which ones it's already notified the diner about. Idempotent flag: a
non-null value means "we've sent the day-before reminder; don't send
again." Nullable + no default — every existing booking starts at null
and will get reminded once if its slot is still in the future.

Additive, non-breaking.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e7b3c9d12a4f"
down_revision: Union[str, None] = "d9f4a2e1b56c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("bookings", sa.Column("reminder_sent_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column("bookings", "reminder_sent_at")
