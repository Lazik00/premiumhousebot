"""add property layout metadata

Revision ID: 20260331_0011
Revises: 20260327_0010
Create Date: 2026-03-31 14:50:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = '20260331_0011'
down_revision = '20260327_0010'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('properties', sa.Column('total_area_sqm', sa.Numeric(10, 2), nullable=True))
    op.add_column('properties', sa.Column('floor', sa.SmallInteger(), nullable=True))
    op.add_column('properties', sa.Column('total_floors', sa.SmallInteger(), nullable=True))
    op.add_column('properties', sa.Column('bedrooms', sa.SmallInteger(), nullable=True))
    op.add_column('properties', sa.Column('beds', sa.SmallInteger(), nullable=True))


def downgrade() -> None:
    op.drop_column('properties', 'beds')
    op.drop_column('properties', 'bedrooms')
    op.drop_column('properties', 'total_floors')
    op.drop_column('properties', 'floor')
    op.drop_column('properties', 'total_area_sqm')
