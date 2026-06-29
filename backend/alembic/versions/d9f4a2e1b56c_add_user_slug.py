"""add users.slug for public restaurant booking links

Revision ID: d9f4a2e1b56c
Revises: c8d2e4f6a193
Create Date: 2026-06-01 19:00:00.000000

Adds a `slug` column to users so each restaurant has a stable, shareable
public booking URL (savorymind.net/r/{slug}). Restaurants share this link
with their existing diners over WhatsApp / Instagram / email and the
diner books without creating an account.

Nullable + unique. Backfilled by a one-shot on the next profile update
for legacy restaurant rows. Consumer/diner rows leave it null.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d9f4a2e1b56c"
down_revision: Union[str, None] = "c8d2e4f6a193"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Batch mode so the constraint creation works on both Postgres (prod) and
    # SQLite (tests) — SQLite can't ALTER TABLE to add a unique constraint
    # without batch-mode's copy-and-move strategy.
    with op.batch_alter_table("users") as batch_op:
        batch_op.add_column(sa.Column("slug", sa.String(length=80), nullable=True))
        batch_op.create_unique_constraint("uq_users_slug", ["slug"])
        batch_op.create_index("ix_users_slug", ["slug"])


def downgrade() -> None:
    with op.batch_alter_table("users") as batch_op:
        batch_op.drop_index("ix_users_slug")
        batch_op.drop_constraint("uq_users_slug", type_="unique")
        batch_op.drop_column("slug")
