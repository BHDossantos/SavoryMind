"""menu_of_the_day broadcast — restaurant publishes, CRM opt-ins receive

Revision ID: f4a8c2d9e1b7
Revises: e7b3c9d12a4f
Create Date: 2026-06-23 00:00:00.000000

Adds three columns to support the lunch-decision-time menu SMS feature:

  users.menu_of_the_day
    Restaurant-only. Free-text body of today's menu the cron will
    broadcast. Empty / null = nothing to send.

  users.menu_sms_last_sent_date
    Per-restaurant idempotency flag for the daily cron. Date-only so a
    re-run of the cron on the same calendar day skips restaurants
    already sent.

  crm_customers.menu_sms_opt_in
    Whether this restaurant's CRM customer has opted in to receive
    the daily menu SMS. Defaults False — explicit opt-in.

All additive, all nullable / defaulted, non-breaking. The feature is
dormant on every restaurant until its owner sets menu_of_the_day and
flips at least one CRM customer's menu_sms_opt_in to True.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f4a8c2d9e1b7"
down_revision: Union[str, None] = "e7b3c9d12a4f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("menu_of_the_day", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("menu_sms_last_sent_date", sa.Date(), nullable=True))
    op.add_column(
        "crm_customers",
        sa.Column(
            "menu_sms_opt_in",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("0"),
        ),
    )


def downgrade() -> None:
    op.drop_column("crm_customers", "menu_sms_opt_in")
    op.drop_column("users", "menu_sms_last_sent_date")
    op.drop_column("users", "menu_of_the_day")
