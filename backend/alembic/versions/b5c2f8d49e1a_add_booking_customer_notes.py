"""bookings.customer_notes — manager-private notes about the guest

Revision ID: b5c2f8d49e1a
Revises: a3e8c1f24d09
Create Date: 2026-06-26 00:00:00.000000

Existing `notes` is the guest-visible field (their special requests on the
booking form). `customer_notes` is the operator's private note about the
guest — "allergic to shellfish", "VIP, comp dessert", "celebrating
anniversary" — surfaced on every future booking from the same diner via
phone-match repeat detection.

Additive, nullable. Old code paths reading only `notes` keep working.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b5c2f8d49e1a"
down_revision: Union[str, None] = "a3e8c1f24d09"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("bookings", sa.Column("customer_notes", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("bookings", "customer_notes")
