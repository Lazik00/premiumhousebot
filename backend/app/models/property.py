import uuid
from datetime import date

from sqlalchemy import Boolean, Date, Enum, ForeignKey, Index, Numeric, SmallInteger, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import TSVECTOR, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin, enum_values
from app.models.enums import PropertyStatus, PropertyType


class Region(Base, UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = 'regions'

    name_uz: Mapped[str] = mapped_column(String(120), nullable=False)
    name_ru: Mapped[str | None] = mapped_column(String(120), nullable=True)
    name_en: Mapped[str | None] = mapped_column(String(120), nullable=True)
    slug: Mapped[str] = mapped_column(String(120), nullable=False, unique=True)


class City(Base, UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = 'cities'
    __table_args__ = (UniqueConstraint('region_id', 'slug', name='uq_city_region_slug'),)

    region_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey('regions.id'), nullable=False)
    name_uz: Mapped[str] = mapped_column(String(120), nullable=False)
    name_ru: Mapped[str | None] = mapped_column(String(120), nullable=True)
    name_en: Mapped[str | None] = mapped_column(String(120), nullable=True)
    slug: Mapped[str] = mapped_column(String(120), nullable=False)


class Property(Base, UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = 'properties'
    __table_args__ = (
        Index('idx_properties_city', 'city_id'),
        Index('idx_properties_price', 'price_per_night'),
        Index('idx_properties_rating', 'average_rating'),
        Index('idx_properties_status', 'status'),
        Index('idx_properties_search', 'search_vector', postgresql_using='gin'),
    )

    host_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=False)
    region_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey('regions.id'), nullable=False)
    city_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey('cities.id'), nullable=False)

    title: Mapped[str] = mapped_column(String(180), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    address: Mapped[str] = mapped_column(Text, nullable=False)

    latitude: Mapped[float] = mapped_column(Numeric(9, 6), nullable=False)
    longitude: Mapped[float] = mapped_column(Numeric(9, 6), nullable=False)

    property_type: Mapped[PropertyType] = mapped_column(
        Enum(PropertyType, name='property_type', values_callable=enum_values),
        nullable=False,
        default=PropertyType.APARTMENT,
    )

    capacity: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    rooms: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    bathrooms: Mapped[int] = mapped_column(SmallInteger, nullable=False)

    price_per_night: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default='UZS')
    cleaning_fee: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    service_fee: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)

    cancellation_policy: Mapped[str | None] = mapped_column(Text, nullable=True)
    house_rules: Mapped[str | None] = mapped_column(Text, nullable=True)

    average_rating: Mapped[float] = mapped_column(Numeric(3, 2), nullable=False, default=0)
    review_count: Mapped[int] = mapped_column(nullable=False, default=0)

    status: Mapped[PropertyStatus] = mapped_column(
        Enum(PropertyStatus, name='property_status', values_callable=enum_values),
        nullable=False,
        default=PropertyStatus.DRAFT,
    )

    search_vector: Mapped[str | None] = mapped_column(TSVECTOR, nullable=True)


class PropertyDateBlock(Base, UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = 'property_date_blocks'
    __table_args__ = (
        Index('idx_property_date_blocks_property_dates', 'property_id', 'start_date', 'end_date'),
        Index('idx_property_date_blocks_created_by', 'created_by_user_id', 'created_at'),
    )

    property_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey('properties.id'), nullable=False)
    created_by_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=True)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)


class PropertyImage(Base, UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = 'property_images'
    __table_args__ = (UniqueConstraint('property_id', 'sort_order', name='uq_property_image_sort'),)

    property_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey('properties.id'), nullable=False)
    object_key: Mapped[str] = mapped_column(String(255), nullable=False)
    image_url: Mapped[str] = mapped_column(Text, nullable=False)
    is_cover: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    sort_order: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=1)


class Amenity(Base, UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = 'amenities'

    code: Mapped[str] = mapped_column(String(60), nullable=False, unique=True)
    name_uz: Mapped[str] = mapped_column(String(120), nullable=False)
    name_ru: Mapped[str | None] = mapped_column(String(120), nullable=True)
    name_en: Mapped[str | None] = mapped_column(String(120), nullable=True)
    icon: Mapped[str | None] = mapped_column(String(120), nullable=True)


class PropertyAmenity(Base, UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = 'property_amenities'
    __table_args__ = (UniqueConstraint('property_id', 'amenity_id', name='uq_property_amenity'),)

    property_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey('properties.id'), nullable=False)
    amenity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey('amenities.id'), nullable=False)
