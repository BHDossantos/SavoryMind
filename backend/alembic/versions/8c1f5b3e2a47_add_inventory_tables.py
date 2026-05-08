"""add inventory tables + users.timezone column

Revision ID: 8c1f5b3e2a47
Revises: d655b6eb282c
Create Date: 2026-05-07 09:00:00.000000

Phase 1 (restaurant inventory tracking):
- `inventory_items` — per-SKU rows owned by restaurant users
- `inventory_adjustments` — append-only ledger; current_quantity is
  derived at read-time, never stored
- `users.timezone` — IANA TZ name, default 'UTC'. Used by the weekly
  inventory digest to fire Monday 8am restaurant-local.

The migration is purely additive; existing rows get `timezone='UTC'`
via server_default. No backfill needed. See
.planning/phases/phase-1-restaurant-inventory-tracking/THREAT-MODEL.md
T8 for the rollback story.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "8c1f5b3e2a47"
down_revision: Union[str, None] = "d655b6eb282c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "inventory_items",
        sa.Column("id", sa.Integer(), nullable=False, autoincrement=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("category", sa.String(length=20), nullable=False),
        sa.Column("unit", sa.String(length=20), nullable=False),
        sa.Column("par_level", sa.Float(), nullable=False),
        sa.Column("reorder_quantity", sa.Float(), nullable=True),
        sa.Column("supplier", sa.String(length=120), nullable=True),
        sa.Column("cost_per_unit", sa.Float(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("archived_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_inventory_items_user_id", "inventory_items", ["user_id"])

    op.create_table(
        "inventory_adjustments",
        sa.Column("id", sa.Integer(), nullable=False, autoincrement=True),
        sa.Column("item_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("adjustment_type", sa.String(length=20), nullable=False),
        sa.Column("delta", sa.Float(), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["item_id"], ["inventory_items.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_inventory_adjustments_item_id", "inventory_adjustments", ["item_id"])
    op.create_index("ix_inventory_adjustments_user_id", "inventory_adjustments", ["user_id"])
    op.create_index("ix_inventory_adjustments_created_at", "inventory_adjustments", ["created_at"])
    op.create_index("ix_inventory_adjustments_item_user", "inventory_adjustments", ["item_id", "user_id"])

    # Add timezone column to users with server_default so legacy rows get 'UTC'.
    op.add_column(
        "users",
        sa.Column("timezone", sa.String(length=64), nullable=False, server_default="UTC"),
    )


def downgrade() -> None:
    op.drop_column("users", "timezone")
    op.drop_index("ix_inventory_adjustments_item_user", table_name="inventory_adjustments")
    op.drop_index("ix_inventory_adjustments_created_at", table_name="inventory_adjustments")
    op.drop_index("ix_inventory_adjustments_user_id", table_name="inventory_adjustments")
    op.drop_index("ix_inventory_adjustments_item_id", table_name="inventory_adjustments")
    op.drop_table("inventory_adjustments")
    op.drop_index("ix_inventory_items_user_id", table_name="inventory_items")
    op.drop_table("inventory_items")
