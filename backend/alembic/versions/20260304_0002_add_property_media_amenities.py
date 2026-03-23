"""add property media and amenities tables

Revision ID: 20260304_0002
Revises: 20260303_0001
Create Date: 2026-03-04 06:10:00
"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '20260304_0002'
down_revision: Union[str, None] = '20260303_0001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS amenities (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            code VARCHAR(60) NOT NULL UNIQUE,
            name_uz VARCHAR(120) NOT NULL,
            name_ru VARCHAR(120),
            name_en VARCHAR(120),
            icon VARCHAR(120),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            deleted_at TIMESTAMPTZ
        );

        CREATE TABLE IF NOT EXISTS property_images (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            property_id UUID NOT NULL REFERENCES properties(id),
            object_key VARCHAR(255) NOT NULL,
            image_url TEXT NOT NULL,
            is_cover BOOLEAN NOT NULL DEFAULT FALSE,
            sort_order SMALLINT NOT NULL DEFAULT 1,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            deleted_at TIMESTAMPTZ,
            CONSTRAINT uq_property_image_sort UNIQUE(property_id, sort_order)
        );

        CREATE TABLE IF NOT EXISTS property_amenities (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            property_id UUID NOT NULL REFERENCES properties(id),
            amenity_id UUID NOT NULL REFERENCES amenities(id),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            deleted_at TIMESTAMPTZ,
            CONSTRAINT uq_property_amenity UNIQUE(property_id, amenity_id)
        );

        CREATE INDEX IF NOT EXISTS idx_property_images_property
            ON property_images(property_id, sort_order)
            WHERE deleted_at IS NULL;

        CREATE INDEX IF NOT EXISTS idx_property_images_cover
            ON property_images(property_id)
            WHERE is_cover IS TRUE AND deleted_at IS NULL;

        CREATE INDEX IF NOT EXISTS idx_property_amenities_property
            ON property_amenities(property_id)
            WHERE deleted_at IS NULL;

        CREATE INDEX IF NOT EXISTS idx_property_amenities_amenity
            ON property_amenities(amenity_id)
            WHERE deleted_at IS NULL;

        INSERT INTO amenities (code, name_uz, name_ru, name_en, icon)
        VALUES
            ('wifi', 'Wi-Fi', 'Wi-Fi', 'Wi-Fi', 'wifi'),
            ('parking', 'Avtoturargoh', 'Парковка', 'Parking', 'car'),
            ('air_conditioner', 'Konditsioner', 'Кондиционер', 'Air Conditioner', 'snowflake'),
            ('pool', 'Basseyn', 'Бассейн', 'Pool', 'waves'),
            ('kitchen', 'Oshxona', 'Кухня', 'Kitchen', 'chef-hat'),
            ('washer', 'Kir yuvish mashinasi', 'Стиральная машина', 'Washer', 'washing-machine'),
            ('tv', 'Televizor', 'Телевизор', 'TV', 'tv'),
            ('workspace', 'Ish joyi', 'Рабочее место', 'Workspace', 'briefcase')
        ON CONFLICT (code) DO UPDATE
        SET
            name_uz = EXCLUDED.name_uz,
            name_ru = EXCLUDED.name_ru,
            name_en = EXCLUDED.name_en,
            icon = EXCLUDED.icon,
            updated_at = NOW();
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DROP TABLE IF EXISTS property_amenities;
        DROP TABLE IF EXISTS property_images;
        DROP TABLE IF EXISTS amenities;
        """
    )
