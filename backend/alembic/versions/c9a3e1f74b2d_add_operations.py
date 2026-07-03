"""ops_tasks + checklist_templates + checklist_items

Revision ID: c9a3e1f74b2d
Revises: b6f2a9d31c07
Create Date: 2026-07-03 02:00:00.000000

Restaurant OS Wave E — Operations (the last of the 10 modules).

  ops_tasks
    One-off or daily tasks: title, category (opening/closing/prep/
    compliance/maintenance), assignee, due date, done flag.

  checklist_templates + checklist_items
    Reusable checklists ("Opening", "Closing", "Health & Safety") the
    operator instantiates into ops_tasks for a given day.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c9a3e1f74b2d"
down_revision: Union[str, None] = "b6f2a9d31c07"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "ops_tasks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("category", sa.String(40), nullable=False, server_default="general"),
        sa.Column("assignee", sa.String(120), nullable=True),
        sa.Column("due_date", sa.Date(), nullable=True, index=True),
        sa.Column("done", sa.Boolean(), nullable=False, server_default="0"),
        sa.Column("done_at", sa.DateTime(), nullable=True),
        sa.Column("source_template_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_table(
        "checklist_templates",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("category", sa.String(40), nullable=False, server_default="general"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_table(
        "checklist_items",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("template_id", sa.Integer(), sa.ForeignKey("checklist_templates.id"), nullable=False, index=True),
        sa.Column("label", sa.String(200), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_table("checklist_items")
    op.drop_table("checklist_templates")
    op.drop_table("ops_tasks")
