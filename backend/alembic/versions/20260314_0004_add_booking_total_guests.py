"""add booking total guests

Revision ID: 20260314_0004
Revises: 20260314_0003
Create Date: 2026-03-14 13:10:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260314_0004"
down_revision = "20260314_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("bookings", sa.Column("guests_total", sa.Integer(), nullable=True))
    op.execute(
        """
        UPDATE bookings
        SET guests_total = GREATEST(
            COALESCE(guests_adults_men, 0) +
            COALESCE(guests_adults_women, 0) +
            COALESCE(guests_children, 0),
            1
        )
        WHERE guests_total IS NULL
        """
    )
    op.alter_column("bookings", "guests_total", nullable=False, server_default="1")


def downgrade() -> None:
    op.drop_column("bookings", "guests_total")
