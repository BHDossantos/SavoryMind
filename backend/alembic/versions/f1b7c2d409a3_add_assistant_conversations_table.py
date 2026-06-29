"""add assistant_conversations table

Revision ID: f1b7c2d409a3
Revises: e8a3d1f0c952
Create Date: 2026-05-14 13:00:00.000000

Phase 14 — persisted Flavor chat threads. A new table holding the
full Anthropic-shape message list per conversation so users can
reopen the chat and resume (or continue on another device).

New table only — no changes to existing tables, fully non-breaking.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f1b7c2d409a3"
down_revision: Union[str, None] = "e8a3d1f0c952"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "assistant_conversations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=120), nullable=True),
        sa.Column("messages", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_assistant_conversations_id", "assistant_conversations", ["id"])
    op.create_index("ix_assistant_conversations_user_id", "assistant_conversations", ["user_id"])
    op.create_index(
        "ix_assistant_conversations_user_updated",
        "assistant_conversations",
        ["user_id", "updated_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_assistant_conversations_user_updated", table_name="assistant_conversations")
    op.drop_index("ix_assistant_conversations_user_id", table_name="assistant_conversations")
    op.drop_index("ix_assistant_conversations_id", table_name="assistant_conversations")
    op.drop_table("assistant_conversations")
