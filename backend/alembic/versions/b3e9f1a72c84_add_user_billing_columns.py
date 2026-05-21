"""add user billing/subscription columns

Revision ID: b3e9f1a72c84
Revises: a91c5e3d7f02
Create Date: 2026-05-21 00:00:00.000000

Adds Stripe billing columns to the `users` table for the consumer Premium
subscription. The existing `plan` column stays the entitlement gate
("free" | "premium"); these columns mirror Stripe's state so the billing
UI and webhook can keep `plan` accurate.

Additive + non-breaking. All columns are nullable — legacy rows simply
have no Stripe linkage until their owner starts a checkout.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b3e9f1a72c84"
down_revision: Union[str, None] = "a91c5e3d7f02"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("stripe_customer_id", sa.String(length=255), nullable=True))
    op.add_column("users", sa.Column("stripe_subscription_id", sa.String(length=255), nullable=True))
    op.add_column("users", sa.Column("subscription_status", sa.String(length=50), nullable=True))
    op.add_column("users", sa.Column("subscription_period_end", sa.DateTime(), nullable=True))
    op.create_index("ix_users_stripe_customer_id", "users", ["stripe_customer_id"])


def downgrade() -> None:
    op.drop_index("ix_users_stripe_customer_id", table_name="users")
    op.drop_column("users", "subscription_period_end")
    op.drop_column("users", "subscription_status")
    op.drop_column("users", "stripe_subscription_id")
    op.drop_column("users", "stripe_customer_id")
