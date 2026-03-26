"""add property date blocks

Revision ID: 20260326_0009
Revises: 20260326_0008
Create Date: 2026-03-26 16:40:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = '20260326_0009'
down_revision = '20260326_0008'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'property_date_blocks',
        sa.Column('property_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_by_user_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('start_date', sa.Date(), nullable=False),
        sa.Column('end_date', sa.Date(), nullable=False),
        sa.Column('note', sa.Text(), nullable=True),
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['created_by_user_id'], ['users.id']),
        sa.ForeignKeyConstraint(['property_id'], ['properties.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        'idx_property_date_blocks_property_dates',
        'property_date_blocks',
        ['property_id', 'start_date', 'end_date'],
        unique=False,
    )
    op.create_index(
        'idx_property_date_blocks_created_by',
        'property_date_blocks',
        ['created_by_user_id', 'created_at'],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index('idx_property_date_blocks_created_by', table_name='property_date_blocks')
    op.drop_index('idx_property_date_blocks_property_dates', table_name='property_date_blocks')
    op.drop_table('property_date_blocks')
