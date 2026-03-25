"""scope payment idempotency to booking and provider

Revision ID: 20260325_0006
Revises: 20260325_0005
Create Date: 2026-03-25 23:55:00.000000
"""

from alembic import op

# revision identifiers, used by Alembic.
revision = '20260325_0006'
down_revision = '20260325_0005'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint('uq_payment_idempotency_key', 'payments', type_='unique')
    op.create_unique_constraint(
        'uq_payment_booking_provider_idempotency',
        'payments',
        ['booking_id', 'provider', 'idempotency_key'],
    )


def downgrade() -> None:
    op.drop_constraint('uq_payment_booking_provider_idempotency', 'payments', type_='unique')
    op.create_unique_constraint('uq_payment_idempotency_key', 'payments', ['idempotency_key'])
