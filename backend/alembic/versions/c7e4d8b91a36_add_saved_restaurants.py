"""saved_restaurants — consumer favorites

Revision ID: c7e4d8b91a36
Revises: b5c2f8d49e1a
Create Date: 2026-06-26 02:00:00.000000

The consumer can save a restaurant from any discovery surface. Saved
restaurants surface in the dashboard's "your favorites" rail and unlock
the geofence layer (Stage 2 of the original SMS ask) when we ship it.
Unique constraint on (user_id, restaurant_id) so a double-tap doesn't
create duplicate rows.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c7e4d8b91a36"
down_revision: Union[str, None] = "b5c2f8d49e1a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "saved_restaurants",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("restaurant_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("user_id", "restaurant_id", name="uq_saved_user_restaurant"),
    )


def downgrade() -> None:
    op.drop_table("saved_restaurants")
