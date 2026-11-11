"""Add verified native store membership state, separate from Stripe."""
from alembic import op
import sqlalchemy as sa
revision = 'a31d11e70002'
down_revision = 'a31d11e70001'
branch_labels = None
depends_on = None

def upgrade():
    op.create_table('store_memberships',
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('app_user_id', sa.String(36), nullable=False, unique=True),
        sa.Column('status', sa.String(20), nullable=False),
        sa.Column('product_id', sa.String(128), nullable=True),
        sa.Column('store', sa.String(20), nullable=True),
        sa.Column('expires_at', sa.DateTime(), nullable=True))
    op.create_table('store_receipts',
        sa.Column('receipt_key', sa.String(180), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False))
    op.create_index('ix_store_receipts_user_id', 'store_receipts', ['user_id'])

def downgrade():
    op.drop_table('store_receipts')
    op.drop_table('store_memberships')
