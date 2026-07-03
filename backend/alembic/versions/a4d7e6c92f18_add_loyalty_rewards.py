"""loyalty_rewards + loyalty_redemptions

Revision ID: a4d7e6c92f18
Revises: f1a9c3e58b27
Create Date: 2026-06-30 00:00:00.000000

Restaurant OS Wave C. Points + tiers already accrue on crm_customers
(Wave A). This adds the reward catalog a restaurant defines and the
redemption log that deducts points. Additive; both tables new.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a4d7e6c92f18"
down_revision: Union[str, None] = "f1a9c3e58b27"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "loyalty_rewards",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("points_cost", sa.Integer(), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_table(
        "loyalty_redemptions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("customer_id", sa.Integer(), sa.ForeignKey("crm_customers.id"), nullable=False, index=True),
        sa.Column("reward_id", sa.Integer(), sa.ForeignKey("loyalty_rewards.id"), nullable=True),
        sa.Column("reward_name", sa.String(120), nullable=False),
        sa.Column("points_spent", sa.Integer(), nullable=False),
        sa.Column("redeemed_at", sa.DateTime(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("loyalty_redemptions")
    op.drop_table("loyalty_rewards")
