"""Add durable account deletion intake and verification state."""
from alembic import op
import sqlalchemy as sa
revision = 'a31d11e70001'
down_revision = 'f1c3d7a92b60'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('users', sa.Column('subscription_cancel_at_period_end', sa.Boolean(), nullable=False, server_default=sa.false()))
    op.create_table('account_deletion_requests',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('email', sa.String(254), nullable=True, unique=True),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('status', sa.String(32), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('verified_at', sa.DateTime(), nullable=True),
        sa.Column('verification_hash', sa.String(64), nullable=True, unique=True),
        sa.Column('verification_expires_at', sa.DateTime(), nullable=True),
        sa.Column('notification_sent_at', sa.DateTime(), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('completion_evidence', sa.Text(), nullable=True),
        sa.Column('retention_summary', sa.Text(), nullable=True),
    )
    op.create_index('ix_account_deletion_requests_user_id', 'account_deletion_requests', ['user_id'])


def downgrade():
    op.drop_column('users', 'subscription_cancel_at_period_end')
    op.drop_table('account_deletion_requests')
