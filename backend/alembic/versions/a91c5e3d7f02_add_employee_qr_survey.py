"""add employee QR token + survey response table

Revision ID: a91c5e3d7f02
Revises: f1b7c2d409a3
Create Date: 2026-05-15 12:00:00.000000

Employee QR survey feature.
  - users.qr_token: nullable unique string, set per staff row so a printed
    QR identifies exactly one employee. Backfilled for existing staff
    rows so prior employees get codes without admin action.
  - employee_survey_responses: anonymous per-device submissions tied to
    an employee + their restaurant.
"""
import uuid
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a91c5e3d7f02"
down_revision: Union[str, None] = "f1b7c2d409a3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("qr_token", sa.String(length=36), nullable=True))
    op.create_index("ix_users_qr_token", "users", ["qr_token"], unique=True)

    op.create_table(
        "employee_survey_responses",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("employee_user_id", sa.Integer(), nullable=False),
        sa.Column("restaurant_user_id", sa.Integer(), nullable=False),
        sa.Column("device_id", sa.String(length=64), nullable=False),
        sa.Column("responses", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["employee_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["restaurant_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_employee_survey_responses_id", "employee_survey_responses", ["id"])
    op.create_index("ix_employee_survey_responses_employee_user_id", "employee_survey_responses", ["employee_user_id"])
    op.create_index("ix_employee_survey_responses_restaurant_user_id", "employee_survey_responses", ["restaurant_user_id"])
    op.create_index("ix_employee_survey_responses_device_id", "employee_survey_responses", ["device_id"])
    op.create_index(
        "ix_employee_survey_restaurant_created",
        "employee_survey_responses",
        ["restaurant_user_id", "created_at"],
    )

    # Backfill qr_token for existing staff rows. Done row-by-row because
    # SQLite (used in tests + local dev) lacks gen_random_uuid(); Postgres
    # could do this inline but the row count here is tiny so a Python loop
    # is fine on both.
    bind = op.get_bind()
    staff_ids = [row[0] for row in bind.execute(
        sa.text("SELECT id FROM users WHERE account_type = 'staff'")
    ).fetchall()]
    for sid in staff_ids:
        bind.execute(
            sa.text("UPDATE users SET qr_token = :tok WHERE id = :id"),
            {"tok": str(uuid.uuid4()), "id": sid},
        )


def downgrade() -> None:
    op.drop_index("ix_employee_survey_restaurant_created", table_name="employee_survey_responses")
    op.drop_index("ix_employee_survey_responses_device_id", table_name="employee_survey_responses")
    op.drop_index("ix_employee_survey_responses_restaurant_user_id", table_name="employee_survey_responses")
    op.drop_index("ix_employee_survey_responses_employee_user_id", table_name="employee_survey_responses")
    op.drop_index("ix_employee_survey_responses_id", table_name="employee_survey_responses")
    op.drop_table("employee_survey_responses")

    op.drop_index("ix_users_qr_token", table_name="users")
    op.drop_column("users", "qr_token")
