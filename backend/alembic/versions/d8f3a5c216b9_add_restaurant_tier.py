"""users.restaurant_tier — tiered pricing entitlement

Revision ID: d8f3a5c216b9
Revises: c7e4d8b91a36
Create Date: 2026-06-26 04:00:00.000000

Tracks which restaurant subscription tier (starter / growth / pro) the
user is entitled to. The Stripe webhook sets this from the Price ID the
operator subscribed against. Null on free users; the entitlements layer
defaults to "starter" in that case so the booking-link / CRM / menu-
broadcast wedge is always available to pull them in.

Additive, nullable. Existing "pro" users are unaffected — their tier is
inferred via the legacy fallback in entitlements.py.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d8f3a5c216b9"
down_revision: Union[str, None] = "c7e4d8b91a36"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("restaurant_tier", sa.String(20), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "restaurant_tier")
