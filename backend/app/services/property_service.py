import uuid
from dataclasses import dataclass
from datetime import date, datetime

from sqlalchemy import and_, exists, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.booking import Booking
from app.models.enums import BookingStatus, PropertyStatus
from app.models.property import Amenity, City, Property, PropertyAmenity, PropertyDateBlock, PropertyImage, Region
from app.models.user import User


@dataclass
class AvailabilityRange:
    id: uuid.UUID | None
    source: str
    start_date: date
    end_date: date
    status: str
    label: str | None = None
    note: str | None = None
    booking_id: uuid.UUID | None = None
    booking_code: str | None = None
    created_at: datetime | None = None


class PropertyService:
    async def list_properties(
        self,
        db: AsyncSession,
        *,
        city: str | None,
        min_price: float | None,
        max_price: float | None,
        guests: int | None,
        check_in: date | None,
        check_out: date | None,
        limit: int,
        offset: int,
    ) -> tuple[list[tuple[Property, City, Region]], int]:
        base_query = (
            select(Property, City, Region)
            .join(City, City.id == Property.city_id)
            .join(Region, Region.id == Property.region_id)
            .where(
                Property.deleted_at.is_(None),
                Property.status == PropertyStatus.ACTIVE,
                City.deleted_at.is_(None),
                Region.deleted_at.is_(None),
            )
        )

        if city:
            search_term = f'%{city.strip()}%'
            base_query = base_query.where(
                or_(
                    City.name_uz.ilike(search_term),
                    City.name_ru.ilike(search_term),
                    City.name_en.ilike(search_term),
                    Region.name_uz.ilike(search_term),
                    Region.name_ru.ilike(search_term),
                    Region.name_en.ilike(search_term),
                )
            )

        if min_price is not None:
            base_query = base_query.where(Property.price_per_night >= min_price)
        if max_price is not None:
            base_query = base_query.where(Property.price_per_night <= max_price)
        if guests is not None:
            base_query = base_query.where(Property.capacity >= guests)

        if check_in and check_out:
            booking_overlap_exists = exists(
                select(Booking.id).where(
                    Booking.property_id == Property.id,
                    Booking.deleted_at.is_(None),
                    Booking.status.in_(
                        [
                            BookingStatus.PENDING_PAYMENT,
                            BookingStatus.AWAITING_CONFIRMATION,
                            BookingStatus.CONFIRMED,
                            BookingStatus.COMPLETED,
                        ]
                    ),
                    and_(Booking.start_date < check_out, Booking.end_date > check_in),
                )
            )
            manual_overlap_exists = exists(
                select(PropertyDateBlock.id).where(
                    PropertyDateBlock.property_id == Property.id,
                    PropertyDateBlock.deleted_at.is_(None),
                    and_(PropertyDateBlock.start_date < check_out, PropertyDateBlock.end_date > check_in),
                )
            )
            base_query = base_query.where(~booking_overlap_exists, ~manual_overlap_exists)

        total_query = select(func.count()).select_from(base_query.subquery())
        total = int((await db.execute(total_query)).scalar_one())

        rows_query = base_query.order_by(Property.created_at.desc()).limit(limit).offset(offset)
        rows = (await db.execute(rows_query)).all()
        return rows, total

    async def get_cover_image(self, db: AsyncSession, property_id: uuid.UUID) -> str | None:
        query = (
            select(PropertyImage.image_url)
            .where(
                PropertyImage.property_id == property_id,
                PropertyImage.deleted_at.is_(None),
                PropertyImage.is_cover.is_(True),
            )
            .limit(1)
        )
        result = await db.execute(query)
        row = result.scalar_one_or_none()
        if row:
            return row
        fallback = (
            select(PropertyImage.image_url)
            .where(
                PropertyImage.property_id == property_id,
                PropertyImage.deleted_at.is_(None),
            )
            .order_by(PropertyImage.sort_order.asc())
            .limit(1)
        )
        return (await db.execute(fallback)).scalar_one_or_none()

    async def get_property_images(self, db: AsyncSession, property_id: uuid.UUID) -> list[PropertyImage]:
        query = (
            select(PropertyImage)
            .where(
                PropertyImage.property_id == property_id,
                PropertyImage.deleted_at.is_(None),
            )
            .order_by(PropertyImage.sort_order.asc())
        )
        result = await db.execute(query)
        return list(result.scalars().all())

    async def get_property_amenities(self, db: AsyncSession, property_id: uuid.UUID) -> list[Amenity]:
        query = (
            select(Amenity)
            .join(PropertyAmenity, PropertyAmenity.amenity_id == Amenity.id)
            .where(
                PropertyAmenity.property_id == property_id,
                PropertyAmenity.deleted_at.is_(None),
                Amenity.deleted_at.is_(None),
            )
            .order_by(Amenity.name_uz.asc())
        )
        result = await db.execute(query)
        return list(result.scalars().all())

    async def get_host(self, db: AsyncSession, host_id: uuid.UUID) -> User | None:
        query = select(User).where(User.id == host_id, User.deleted_at.is_(None))
        result = await db.execute(query)
        return result.scalar_one_or_none()

    async def get_property_detail(self, db: AsyncSession, property_id: uuid.UUID) -> tuple[Property, City, Region] | None:
        query = (
            select(Property, City, Region)
            .join(City, City.id == Property.city_id)
            .join(Region, Region.id == Property.region_id)
            .where(
                Property.id == property_id,
                Property.deleted_at.is_(None),
                Property.status == PropertyStatus.ACTIVE,
                City.deleted_at.is_(None),
                Region.deleted_at.is_(None),
            )
        )
        row = (await db.execute(query)).one_or_none()
        if row is None:
            return None
        return row[0], row[1], row[2]

    async def get_blocked_ranges(
        self,
        db: AsyncSession,
        *,
        property_id: uuid.UUID,
        from_date: date | None,
        to_date: date | None,
    ) -> list[AvailabilityRange]:
        booking_query = select(Booking).where(
            Booking.property_id == property_id,
            Booking.deleted_at.is_(None),
            Booking.status.in_(
                [
                    BookingStatus.PENDING_PAYMENT,
                    BookingStatus.AWAITING_CONFIRMATION,
                    BookingStatus.CONFIRMED,
                    BookingStatus.COMPLETED,
                ]
            ),
        )
        manual_query = select(PropertyDateBlock).where(
            PropertyDateBlock.property_id == property_id,
            PropertyDateBlock.deleted_at.is_(None),
        )

        if from_date and to_date:
            booking_query = booking_query.where(and_(Booking.start_date < to_date, Booking.end_date > from_date))
            manual_query = manual_query.where(and_(PropertyDateBlock.start_date < to_date, PropertyDateBlock.end_date > from_date))
        elif from_date:
            booking_query = booking_query.where(Booking.end_date > from_date)
            manual_query = manual_query.where(PropertyDateBlock.end_date > from_date)
        elif to_date:
            booking_query = booking_query.where(Booking.start_date < to_date)
            manual_query = manual_query.where(PropertyDateBlock.start_date < to_date)

        booking_query = booking_query.order_by(Booking.start_date.asc())
        manual_query = manual_query.order_by(PropertyDateBlock.start_date.asc())
        booking_rows = list((await db.execute(booking_query)).scalars().all())
        manual_rows = list((await db.execute(manual_query)).scalars().all())

        combined = [
            AvailabilityRange(
                id=booking.id,
                source='booking',
                start_date=booking.start_date,
                end_date=booking.end_date,
                status=booking.status.value,
                label=booking.booking_code,
                booking_id=booking.id,
                booking_code=booking.booking_code,
                created_at=booking.created_at,
            )
            for booking in booking_rows
        ] + [
            AvailabilityRange(
                id=block.id,
                source='manual',
                start_date=block.start_date,
                end_date=block.end_date,
                status='blocked',
                label='manual_block',
                note=block.note,
                created_at=block.created_at,
            )
            for block in manual_rows
        ]
        combined.sort(key=lambda item: (item.start_date, item.end_date, item.source))
        return combined
