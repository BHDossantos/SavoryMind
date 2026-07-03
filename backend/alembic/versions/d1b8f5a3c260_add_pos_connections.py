"""pos_connections — restaurant POS (Square) integration

Revision ID: d1b8f5a3c260
Revises: c9a3e1f74b2d
Create Date: 2026-07-03 04:00:00.000000

Stores the encrypted OAuth tokens + sync state for a restaurant's POS
connection (Square to start). A sync pulls the merchant's catalog into
menu_items and their recent orders into sales_logs + menu_items.
orders_last_30_days, turning the hand-entered demo numbers into real
system-of-record data.

Tokens are Fernet-encrypted at rest (see app/core/encrypted_field.py);
the columns stay TEXT.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d1b8f5a3c260"
down_revision: Union[str, None] = "c9a3e1f74b2d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "pos_connections",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("provider", sa.String(20), nullable=False, server_default="square"),
        sa.Column("merchant_id", sa.String(120), nullable=True),
        sa.Column("merchant_name", sa.String(200), nullable=True),
        sa.Column("access_token", sa.Text(), nullable=True),
        sa.Column("refresh_token", sa.Text(), nullable=True),
        sa.Column("token_expires_at", sa.DateTime(), nullable=True),
        sa.Column("connected", sa.Boolean(), nullable=False, server_default="0"),
        sa.Column("last_synced_at", sa.DateTime(), nullable=True),
        sa.Column("last_sync_stats", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("pos_connections")
