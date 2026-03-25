"""add octo payment provider

Revision ID: 20260325_0005
Revises: 20260314_0004
Create Date: 2026-03-25 18:45:00
"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '20260325_0005'
down_revision: Union[str, None] = '20260314_0004'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE payment_provider ADD VALUE IF NOT EXISTS 'octo';")


def downgrade() -> None:
    # PostgreSQL enum values cannot be removed safely in-place.
    pass
