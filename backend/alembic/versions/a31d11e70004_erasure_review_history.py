"""Auditable re-review of stale prepared erasure plans."""
from alembic import op
import sqlalchemy as sa
revision = 'a31d11e70004'
down_revision = 'a31d11e70003'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('account_erasure_reviews',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('request_id', sa.String(36), sa.ForeignKey('account_erasure_runs.request_id'), nullable=False),
        sa.Column('previous_plan_sha', sa.String(64), nullable=False),
        sa.Column('new_plan_sha', sa.String(64), nullable=False),
        sa.Column('previous_policy_ref', sa.String(200), nullable=False),
        sa.Column('new_policy_ref', sa.String(200), nullable=False),
        sa.Column('review_ref', sa.String(200), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False))
    op.create_index('ix_account_erasure_reviews_request_id', 'account_erasure_reviews', ['request_id'])


def downgrade():
    op.drop_table('account_erasure_reviews')
