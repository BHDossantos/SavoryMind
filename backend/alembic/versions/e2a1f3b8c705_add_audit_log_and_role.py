"""audit_logs + users.role + users.is_demo + UserPermission

Revision ID: e2a1f3b8c705
Revises: d8f3a5c216b9
Create Date: 2026-06-26 06:00:00.000000

Three architectural items from the audit:

  audit_logs
    actor / action / target / metadata / created_at. Captured by a route
    middleware on every mutating request so a manager can answer "who
    deleted the booking yesterday."

  users.role
    owner | manager | chef | server | host | marketer. Defaults to owner
    so legacy rows aren't blocked. The permission check is layered on
    top of account_type — staff accounts inherit the employer's tenant
    but get a restricted view.

  users.is_demo
    Demo accounts get sample data shown but never see real production
    rows; production dashboards filter is_demo=False so the demo doesn't
    pollute investor-facing metrics.

Additive, all nullable/defaulted, non-breaking.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e2a1f3b8c705"
down_revision: Union[str, None] = "d8f3a5c216b9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("actor_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True, index=True),
        sa.Column("tenant_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True, index=True),
        sa.Column("action",     sa.String(80),  nullable=False),
        sa.Column("target",     sa.String(120), nullable=True),
        sa.Column("metadata",   sa.Text(),      nullable=True),
        sa.Column("created_at", sa.DateTime(),  nullable=False),
    )
    op.add_column("users", sa.Column("role", sa.String(20), nullable=False, server_default="owner"))
    op.add_column("users", sa.Column("is_demo", sa.Boolean(), nullable=False, server_default="0"))


def downgrade() -> None:
    op.drop_column("users", "is_demo")
    op.drop_column("users", "role")
    op.drop_table("audit_logs")
