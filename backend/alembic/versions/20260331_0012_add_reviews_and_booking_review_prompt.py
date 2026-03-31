"""add reviews and booking review prompt

Revision ID: 20260331_0012
Revises: 20260331_0011
Create Date: 2026-03-31 16:10:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = '20260331_0012'
down_revision = '20260331_0011'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('bookings', sa.Column('review_prompt_sent_at', sa.DateTime(timezone=True), nullable=True))
    op.create_table(
        'reviews',
        sa.Column('booking_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('property_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('rating', sa.SmallInteger(), nullable=False),
        sa.Column('comment', sa.Text(), nullable=True),
        sa.Column('host_reply', sa.Text(), nullable=True),
        sa.Column('awaiting_comment', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['booking_id'], ['bookings.id']),
        sa.ForeignKeyConstraint(['property_id'], ['properties.id']),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('booking_id', name='uq_review_booking'),
    )
    op.create_index('idx_reviews_property_created', 'reviews', ['property_id', 'created_at'])
    op.create_index('idx_reviews_user_created', 'reviews', ['user_id', 'created_at'])


def downgrade() -> None:
    op.drop_index('idx_reviews_user_created', table_name='reviews')
    op.drop_index('idx_reviews_property_created', table_name='reviews')
    op.drop_table('reviews')
    op.drop_column('bookings', 'review_prompt_sent_at')
