"""users.expo_push_token — native push notifications

Revision ID: e5c1a7f9d380
Revises: d1b8f5a3c260
Create Date: 2026-07-03 06:00:00.000000

Stores the device's Expo push token so the backend can deliver native
push notifications (booking confirmations, menu nudges, win-backs). One
token per user (last device wins) — enough for the pilot; a device table
comes later if multi-device delivery matters. Nullable; no token = no
push (email/SMS/in-app still fire).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e5c1a7f9d380"
down_revision: Union[str, None] = "d1b8f5a3c260"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("expo_push_token", sa.String(200), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "expo_push_token")
