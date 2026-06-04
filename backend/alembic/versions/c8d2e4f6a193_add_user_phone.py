"""add users.phone for SMS booking alerts

Revision ID: c8d2e4f6a193
Revises: b3e9f1a72c84
Create Date: 2026-06-01 18:00:00.000000

Adds a `phone` column to the `users` table so restaurants can receive
SMS notifications when a booking arrives. Restaurants set this via the
inline "Get SMS alerts" widget on their bookings page; the column is
nullable, so legacy rows simply opt out by default and the column stays
empty until they explicitly enable it.

Additive, non-breaking. The booking service's SMS send no-ops when the
column is empty (or when Twilio isn't configured) so no behavior changes
for restaurants that don't set a phone number.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c8d2e4f6a193"
down_revision: Union[str, None] = "b3e9f1a72c84"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("phone", sa.String(length=32), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "phone")
