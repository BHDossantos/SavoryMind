"""add reviews.response + responded_at columns

Revision ID: c4f1a9e7b820
Revises: 9d2b41a83c5f
Create Date: 2026-05-14 10:00:00.000000

Phase 9c — Flavor's respond_to_review action tool. Restaurant
operators can ask Flavor to draft + post a public response to a
guest review. Two additive columns on the existing `reviews` table:

  response       TEXT      — the operator's reply, NULL when unanswered
  responded_at   DATETIME  — when the reply was posted, NULL when unanswered

Additive + non-breaking. Existing rows get NULL for both, which the
sentiment UI renders as "no reply yet".
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c4f1a9e7b820"
down_revision: Union[str, None] = "9d2b41a83c5f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("reviews", sa.Column("response", sa.Text(), nullable=True))
    op.add_column("reviews", sa.Column("responded_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column("reviews", "responded_at")
    op.drop_column("reviews", "response")
