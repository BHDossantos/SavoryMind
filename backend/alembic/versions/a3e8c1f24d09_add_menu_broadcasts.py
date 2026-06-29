"""menu_broadcasts — attribution table for daily menu SMS rounds

Revision ID: a3e8c1f24d09
Revises: f4a8c2d9e1b7
Create Date: 2026-06-25 00:00:00.000000

Adds an attribution trail so a restaurant can see "we drove X clicks and Y
bookings from this week's menu SMS" — the renewal conversation needs this
number, otherwise the €99/mo bill arrives unsupported.

  menu_broadcasts
    One row per restaurant per daily broadcast round. sms_count is set
    when the round is dispatched; click_count and bookings_count
    increment as customers tap the link and follow through.

  bookings.menu_broadcast_id
    FK back to the broadcast that drove this booking (null for
    bookings not attributable to a broadcast). The public booking
    endpoint stamps this from the attribution cookie.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a3e8c1f24d09"
down_revision: Union[str, None] = "f4a8c2d9e1b7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "menu_broadcasts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("sent_at", sa.DateTime(), nullable=False),
        sa.Column("local_date", sa.Date(), nullable=False),
        sa.Column("sms_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("click_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("menu_snapshot", sa.Text(), nullable=True),
    )
    # SQLite can't ALTER TABLE to add a FK constraint in-place; alembic's
    # batch mode does a copy-and-swap that works for both SQLite and
    # Postgres. Add the column + the FK inside the batch block.
    with op.batch_alter_table("bookings") as batch:
        batch.add_column(sa.Column("menu_broadcast_id", sa.Integer(), nullable=True))
        batch.create_foreign_key(
            "fk_bookings_menu_broadcast_id",
            "menu_broadcasts",
            ["menu_broadcast_id"],
            ["id"],
        )


def downgrade() -> None:
    with op.batch_alter_table("bookings") as batch:
        batch.drop_constraint("fk_bookings_menu_broadcast_id", type_="foreignkey")
        batch.drop_column("menu_broadcast_id")
    op.drop_table("menu_broadcasts")
