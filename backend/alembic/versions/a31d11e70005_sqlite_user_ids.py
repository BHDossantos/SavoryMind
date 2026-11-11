"""Prevent SQLite user ID reuse after account erasure.

PostgreSQL already allocates IDs from its sequence. SQLite's table must use
AUTOINCREMENT; erasure additionally inspects the actual schema and fails closed.
"""
from alembic import op
from sqlalchemy import text
revision = 'a31d11e70005'
down_revision = 'a31d11e70004'
branch_labels = None
depends_on = None


def upgrade():
    if op.get_bind().dialect.name == 'sqlite':
        ddl = op.get_bind().scalar(text("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'")) or ''
        if 'AUTOINCREMENT' in ddl.upper():
            return  # Never reset an existing sqlite_sequence high-water mark.
        # DROP TABLE can execute ON DELETE CASCADE, silently erasing child
        # rows even when a subsequent foreign_key_check reports no violation.
        # Refuse before any DDL; never toggle connection enforcement here.
        if op.get_bind().scalar(text('PRAGMA foreign_keys')) != 0:
            raise RuntimeError('SQLite user identity migration requires a separately reviewed offline migration procedure: foreign_keys is enabled; no users-table DDL performed')
        with op.batch_alter_table('users', recreate='always', table_kwargs={'sqlite_autoincrement': True}):
            pass


def downgrade():
    # Keep the non-reuse guarantee: reverting it could revive old credentials.
    pass
