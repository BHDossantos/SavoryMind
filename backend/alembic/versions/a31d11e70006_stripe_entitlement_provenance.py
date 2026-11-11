"""Keep verified Stripe entitlement separate from combined native access.

Existing rows are deliberately not inferred from status or combined plan.
Reconcile existing Stripe subscriptions against the provider before rollout.
"""
from alembic import op
import sqlalchemy as sa

revision = 'a31d11e70006'
down_revision = 'a31d11e70005'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('users', sa.Column('stripe_verified_plan', sa.String(20),
                                    nullable=False, server_default='free'))


def downgrade():
    op.drop_column('users', 'stripe_verified_plan')
