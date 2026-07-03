"""shifts + time_punches

Revision ID: b6f2a9d31c07
Revises: a4d7e6c92f18
Create Date: 2026-07-03 00:00:00.000000

Restaurant OS Wave D — scheduling + time clock.

  shifts
    A planned shift for a staff member on a date, with start/end times
    and role. The weekly schedule reads these.

  time_punches
    Clock-in / clock-out (and optional break) events. Paired into worked
    hours by scheduling_service; feeds real hours into the workforce
    overtime detector (replacing the shift-band estimate).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b6f2a9d31c07"
down_revision: Union[str, None] = "a4d7e6c92f18"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "shifts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("staff_id", sa.Integer(), sa.ForeignKey("staff.id"), nullable=False, index=True),
        sa.Column("date", sa.Date(), nullable=False, index=True),
        sa.Column("start_time", sa.String(5), nullable=False),   # "09:00"
        sa.Column("end_time", sa.String(5), nullable=False),     # "17:00"
        sa.Column("role", sa.String(40), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_table(
        "time_punches",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("staff_id", sa.Integer(), sa.ForeignKey("staff.id"), nullable=False, index=True),
        sa.Column("clock_in", sa.DateTime(), nullable=False),
        sa.Column("clock_out", sa.DateTime(), nullable=True),
        sa.Column("break_minutes", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_table("time_punches")
    op.drop_table("shifts")
