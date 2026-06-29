"""add refresh_token_revocations table

Revision ID: 2d78950e0987
Revises: 4490178aadd3
Create Date: 2026-04-30 18:25:00.000000

Tracks revoked refresh-token JTIs so /auth/refresh can reject a cookie
the user has already logged out of, and so a stolen-then-rotated cookie
can't be replayed. See app/models/auth_revocation.py for the threat
model.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "2d78950e0987"
down_revision: Union[str, None] = "4490178aadd3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "refresh_token_revocations",
        sa.Column("jti", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("revoked_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("jti"),
    )
    op.create_index("ix_refresh_token_revocations_expires_at", "refresh_token_revocations", ["expires_at"])
    op.create_index("ix_refresh_token_revocations_user_id", "refresh_token_revocations", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_refresh_token_revocations_user_id", table_name="refresh_token_revocations")
    op.drop_index("ix_refresh_token_revocations_expires_at", table_name="refresh_token_revocations")
    op.drop_table("refresh_token_revocations")
