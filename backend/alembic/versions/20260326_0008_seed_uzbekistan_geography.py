"""seed uzbekistan geography reference data

Revision ID: 20260326_0008
Revises: 20260325_0007
Create Date: 2026-03-26 18:40:00
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = '20260326_0008'
down_revision: Union[str, None] = '20260325_0007'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

DATA_PATH = Path(__file__).resolve().parents[1] / 'data' / 'uzbekistan_geo.json'


def _load_payload() -> dict[str, list[dict[str, object]]]:
    return json.loads(DATA_PATH.read_text(encoding='utf-8'))


def upgrade() -> None:
    bind = op.get_bind()
    payload = _load_payload()

    region_stmt = sa.text(
        """
        INSERT INTO regions (id, name_uz, name_ru, name_en, slug)
        VALUES (:id, :name_uz, :name_ru, :name_en, :slug)
        ON CONFLICT (slug) DO UPDATE
        SET
            name_uz = EXCLUDED.name_uz,
            name_ru = EXCLUDED.name_ru,
            name_en = EXCLUDED.name_en,
            updated_at = NOW(),
            deleted_at = NULL;
        """
    )
    city_stmt = sa.text(
        """
        INSERT INTO cities (id, region_id, name_uz, name_ru, name_en, slug)
        VALUES (:id, :region_id, :name_uz, :name_ru, :name_en, :slug)
        ON CONFLICT ON CONSTRAINT uq_city_region_slug DO UPDATE
        SET
            name_uz = EXCLUDED.name_uz,
            name_ru = EXCLUDED.name_ru,
            name_en = EXCLUDED.name_en,
            updated_at = NOW(),
            deleted_at = NULL;
        """
    )

    for region in payload['regions']:
        bind.execute(region_stmt, region)

    for city in payload['cities']:
        bind.execute(city_stmt, city)


def downgrade() -> None:
    # Shared reference data is intentionally preserved on downgrade.
    pass
