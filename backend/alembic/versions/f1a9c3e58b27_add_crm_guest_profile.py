"""crm_customers — rich guest profile + loyalty fields

Revision ID: f1a9c3e58b27
Revises: e2a1f3b8c705
Create Date: 2026-06-27 00:00:00.000000

The CRM fields restaurants actually use, plus loyalty. All additive and
nullable / defaulted so existing customer rows are untouched. Powers the
Guest Intelligence layer (birthday campaigns, dietary-aware offers,
segment membership, loyalty tiers).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f1a9c3e58b27"
down_revision: Union[str, None] = "e2a1f3b8c705"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("crm_customers", sa.Column("birthday", sa.Date(), nullable=True))
    op.add_column("crm_customers", sa.Column("anniversary", sa.Date(), nullable=True))
    op.add_column("crm_customers", sa.Column("allergies", sa.Text(), nullable=True))
    op.add_column("crm_customers", sa.Column("favorite_dishes", sa.Text(), nullable=True))
    op.add_column("crm_customers", sa.Column("favorite_drinks", sa.Text(), nullable=True))
    op.add_column("crm_customers", sa.Column("wine_pref", sa.String(), nullable=True))
    op.add_column("crm_customers", sa.Column("seating_pref", sa.String(), nullable=True))
    op.add_column("crm_customers", sa.Column("address", sa.Text(), nullable=True))
    op.add_column("crm_customers", sa.Column("loyalty_points", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("crm_customers", sa.Column("loyalty_tier", sa.String(), nullable=True))


def downgrade() -> None:
    for col in ("loyalty_tier", "loyalty_points", "address", "seating_pref",
                "wine_pref", "favorite_drinks", "favorite_dishes", "allergies",
                "anniversary", "birthday"):
        op.drop_column("crm_customers", col)
