"""add manual payment methods and awaiting confirmation flow

Revision ID: 20260327_0010
Revises: 20260326_0009
Create Date: 2026-03-27 11:20:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = '20260327_0010'
down_revision = '20260326_0009'
branch_labels = None
depends_on = None


MANUAL_PAYMENT_METHODS = sa.Table(
    'manual_payment_methods',
    sa.MetaData(),
    sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
    sa.Column('brand', sa.String(length=30), nullable=False),
    sa.Column('name', sa.String(length=120), nullable=False),
    sa.Column('card_holder', sa.String(length=120), nullable=False),
    sa.Column('card_number', sa.String(length=50), nullable=False),
    sa.Column('instructions', sa.Text(), nullable=True),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('sort_order', sa.SmallInteger(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
)


def upgrade() -> None:
    op.execute("ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'awaiting_confirmation'")
    op.execute("ALTER TYPE payment_provider ADD VALUE IF NOT EXISTS 'manual'")

    op.create_table(
        'manual_payment_methods',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('brand', sa.String(length=30), nullable=False),
        sa.Column('name', sa.String(length=120), nullable=False),
        sa.Column('card_holder', sa.String(length=120), nullable=False),
        sa.Column('card_number', sa.String(length=50), nullable=False),
        sa.Column('instructions', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('sort_order', sa.SmallInteger(), nullable=False, server_default='1'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        'idx_manual_payment_methods_active_sort',
        'manual_payment_methods',
        ['is_active', 'sort_order'],
        unique=False,
    )

    op.add_column('payments', sa.Column('payment_method_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        'fk_payments_payment_method_id_manual_payment_methods',
        'payments',
        'manual_payment_methods',
        ['payment_method_id'],
        ['id'],
    )
    op.create_index('idx_payments_payment_method', 'payments', ['payment_method_id'], unique=False)


def downgrade() -> None:
    op.drop_index('idx_payments_payment_method', table_name='payments')
    op.drop_constraint('fk_payments_payment_method_id_manual_payment_methods', 'payments', type_='foreignkey')
    op.drop_column('payments', 'payment_method_id')
    op.drop_index('idx_manual_payment_methods_active_sort', table_name='manual_payment_methods')
    op.drop_table('manual_payment_methods')
