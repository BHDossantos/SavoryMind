"""add Claude-derived theme columns to reviews

Revision ID: d655b6eb282c
Revises: 2d78950e0987
Create Date: 2026-04-30 19:00:00.000000

Adds columns populated by Claude when ANTHROPIC_API_KEY is set:
themes (JSON list of short tags), complaints (JSON list), praise (JSON
list), tone (single string). VADER's sentiment_score / sentiment_label
columns stay; the new fields supplement them.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d655b6eb282c"
down_revision: Union[str, None] = "2d78950e0987"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("reviews", sa.Column("themes",     sa.Text(), nullable=True))
    op.add_column("reviews", sa.Column("complaints", sa.Text(), nullable=True))
    op.add_column("reviews", sa.Column("praise",     sa.Text(), nullable=True))
    op.add_column("reviews", sa.Column("tone",       sa.String(length=32), nullable=True))


def downgrade() -> None:
    op.drop_column("reviews", "tone")
    op.drop_column("reviews", "praise")
    op.drop_column("reviews", "complaints")
    op.drop_column("reviews", "themes")
