"""add orders + order_items (live table ordering + kitchen display)

Revision ID: f1c3d7a92b60
Revises: e5b2c9a71f48
Create Date: 2026-10-07
"""
import sqlalchemy as sa
from alembic import op

revision = "f1c3d7a92b60"
down_revision = "e5b2c9a71f48"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "orders",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("table_number", sa.Integer(), nullable=False, index=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="open"),
        sa.Column("server_name", sa.String(length=120), nullable=True),
        sa.Column("notes", sa.String(length=500), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, index=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.Column("closed_at", sa.DateTime(), nullable=True),
    )
    op.create_table(
        "order_items",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("order_id", sa.Integer(), sa.ForeignKey("orders.id"), nullable=False, index=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("menu_item_id", sa.Integer(), sa.ForeignKey("menu_items.id"), nullable=True),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("unit_price", sa.Float(), nullable=True),
        sa.Column("station", sa.String(length=60), nullable=False, server_default="cucina", index=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="new"),
        sa.Column("notes", sa.String(length=300), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_order_items_user_status", "order_items", ["user_id", "status"])


def downgrade() -> None:
    op.drop_index("ix_order_items_user_status", table_name="order_items")
    op.drop_table("order_items")
    op.drop_table("orders")
