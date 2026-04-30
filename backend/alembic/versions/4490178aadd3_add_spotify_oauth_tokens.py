"""add spotify oauth token columns to social_connections

Revision ID: 4490178aadd3
Revises: a77e6122ea48
Create Date: 2026-04-30 06:42:00.000000

Adds the columns needed to persist a real Spotify OAuth grant on the
SocialConnection row: the access + refresh tokens, an expiry timestamp
so callers can decide when to refresh, the granted scope list, and the
Spotify-side user id (so future calls don't have to re-fetch /v1/me).

Tokens are stored plaintext for now — a follow-up should KMS-encrypt
them, see PR #18 commit a9ed173.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "4490178aadd3"
down_revision: Union[str, None] = "a77e6122ea48"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("social_connections", sa.Column("access_token", sa.Text(), nullable=True))
    op.add_column("social_connections", sa.Column("refresh_token", sa.Text(), nullable=True))
    op.add_column("social_connections", sa.Column("token_expires_at", sa.DateTime(), nullable=True))
    op.add_column("social_connections", sa.Column("scopes", sa.String(length=500), nullable=True))
    op.add_column("social_connections", sa.Column("provider_user_id", sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column("social_connections", "provider_user_id")
    op.drop_column("social_connections", "scopes")
    op.drop_column("social_connections", "token_expires_at")
    op.drop_column("social_connections", "refresh_token")
    op.drop_column("social_connections", "access_token")
