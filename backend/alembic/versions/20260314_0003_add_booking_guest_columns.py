"""add booking guest columns

Revision ID: 20260314_0003
Revises: 20260304_0002
Create Date: 2026-03-14 17:40:00
"""

from typing import Sequence, Union

from alembic import op


revision: str = '20260314_0003'
down_revision: Union[str, None] = '20260304_0002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE bookings
            ADD COLUMN IF NOT EXISTS guests_adults_men INTEGER NOT NULL DEFAULT 0,
            ADD COLUMN IF NOT EXISTS guests_adults_women INTEGER NOT NULL DEFAULT 0,
            ADD COLUMN IF NOT EXISTS guests_children INTEGER NOT NULL DEFAULT 0;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        ALTER TABLE bookings
            DROP COLUMN IF EXISTS guests_children,
            DROP COLUMN IF EXISTS guests_adults_women,
            DROP COLUMN IF EXISTS guests_adults_men;
        """
    )
