"""add flavor_memories table

Revision ID: e8a3d1f0c952
Revises: c4f1a9e7b820
Create Date: 2026-05-14 11:30:00.000000

Phase 10 — Flavor's persistent memory. A new table holding durable
per-user facts ("allergic to shellfish", "oven runs hot") that
Flavor writes via the remember_fact tool and that get auto-injected
into her system prompt on every conversation.

New table only — no changes to existing tables, fully non-breaking.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e8a3d1f0c952"
down_revision: Union[str, None] = "c4f1a9e7b820"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "flavor_memories",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("fact", sa.Text(), nullable=False),
        sa.Column("category", sa.String(length=30), nullable=False, server_default="context"),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("last_referenced_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_flavor_memories_id", "flavor_memories", ["id"])
    op.create_index("ix_flavor_memories_user_id", "flavor_memories", ["user_id"])
    op.create_index(
        "ix_flavor_memories_user_created",
        "flavor_memories",
        ["user_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_flavor_memories_user_created", table_name="flavor_memories")
    op.drop_index("ix_flavor_memories_user_id", table_name="flavor_memories")
    op.drop_index("ix_flavor_memories_id", table_name="flavor_memories")
    op.drop_table("flavor_memories")
