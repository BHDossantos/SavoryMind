"""Durable, reviewed local erasure runs."""
from alembic import op
import sqlalchemy as sa
revision = 'a31d11e70003'
down_revision = 'a31d11e70002'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('account_erasure_runs',
        sa.Column('request_id', sa.String(36), sa.ForeignKey('account_deletion_requests.id'), primary_key=True),
        sa.Column('plan_sha', sa.String(64), nullable=False),
        sa.Column('policy_ref', sa.String(200), nullable=False),
        sa.Column('state', sa.String(32), nullable=False),
        sa.Column('evidence', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('database_erased_at', sa.DateTime(), nullable=True))


def downgrade():
    op.drop_table('account_erasure_runs')
