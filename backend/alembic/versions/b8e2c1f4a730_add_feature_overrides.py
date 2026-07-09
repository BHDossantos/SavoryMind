"""add feature_overrides (per-account deploy-free flag toggle)

Revision ID: b8e2c1f4a730
Revises: a7c3f9e14b52
Create Date: 2026-07-03
"""
import sqlalchemy as sa
from alembic import op

revision = "b8e2c1f4a730"
down_revision = "a7c3f9e14b52"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "feature_overrides",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("feature", sa.String(length=50), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.UniqueConstraint("user_id", "feature", name="uq_feature_override"),
    )


def downgrade() -> None:
    op.drop_table("feature_overrides")
