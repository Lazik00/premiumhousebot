"""add admin auth and roles

Revision ID: 20260325_0007
Revises: 20260325_0006
Create Date: 2026-03-25 20:30:00
"""

from typing import Sequence, Union

from alembic import op

revision: str = '20260325_0007'
down_revision: Union[str, None] = '20260325_0006'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE users ALTER COLUMN telegram_id DROP NOT NULL;")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);")
    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email_active
        ON users (lower(email))
        WHERE email IS NOT NULL AND deleted_at IS NULL;
        """
    )
    op.execute(
        """
        INSERT INTO roles (code, name)
        VALUES
            ('super_admin', 'Super Admin'),
            ('admin', 'Admin'),
            ('host', 'Host'),
            ('customer', 'Customer')
        ON CONFLICT (code)
        DO UPDATE SET
            name = EXCLUDED.name,
            deleted_at = NULL,
            updated_at = NOW();
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_users_email_active;")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS password_hash;")
