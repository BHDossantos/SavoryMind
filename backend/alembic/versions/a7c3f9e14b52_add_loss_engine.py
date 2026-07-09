"""add loss estimate engine (profile inputs + loss_estimates)

Revision ID: a7c3f9e14b52
Revises: f2d4b8e1a690
Create Date: 2026-07-03
"""
import sqlalchemy as sa
from alembic import op

revision = "a7c3f9e14b52"
down_revision = "f2d4b8e1a690"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("covers_per_day", sa.Integer(), nullable=True))
    op.add_column("users", sa.Column("avg_ticket_eur", sa.Float(), nullable=True))
    op.add_column("users", sa.Column("staff_count", sa.Integer(), nullable=True))
    op.add_column("users", sa.Column("monthly_food_purchases_eur", sa.Float(), nullable=True))
    op.add_column("users", sa.Column("avg_hourly_wage_eur", sa.Float(), nullable=True))

    op.create_table(
        "loss_estimates",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("data_path", sa.String(length=20), nullable=False, server_default="profile"),
        sa.Column("total_monthly_loss_low", sa.Float(), nullable=False, server_default="0"),
        sa.Column("total_monthly_loss_high", sa.Float(), nullable=False, server_default="0"),
        sa.Column("breakdown_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("inputs_json", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("guarantee_triggered", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("loss_estimates")
    op.drop_column("users", "avg_hourly_wage_eur")
    op.drop_column("users", "monthly_food_purchases_eur")
    op.drop_column("users", "staff_count")
    op.drop_column("users", "avg_ticket_eur")
    op.drop_column("users", "covers_per_day")
