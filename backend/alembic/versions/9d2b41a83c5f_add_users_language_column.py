"""add users.language column

Revision ID: 9d2b41a83c5f
Revises: 8c1f5b3e2a47
Create Date: 2026-05-08 17:00:00.000000

Phase 1 of i18n. Adds a `language` column to the `users` table with
default 'en'. Used by the frontend to set its locale on hydration and
by the backend to instruct Claude / Flavor to respond in the user's
language for AI-driven endpoints.

Additive + non-breaking. Legacy rows get 'en' via server_default.
Profile PATCH endpoint accepts updates via existing ProfileUpdate
schema with a validator restricting to supported codes (en, es, it).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "9d2b41a83c5f"
down_revision: Union[str, None] = "8c1f5b3e2a47"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("language", sa.String(length=10), nullable=False, server_default="en"),
    )


def downgrade() -> None:
    op.drop_column("users", "language")
