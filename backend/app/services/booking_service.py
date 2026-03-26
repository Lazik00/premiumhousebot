import secrets
import uuid
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import and_, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.booking import Booking, BookingEvent
from app.models.enums import BookingStatus, PropertyStatus
from app.models.property import Property, PropertyDateBlock
from app.utils.locks import redis_lock


class BookingService:
    async def create_booking(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        property_id: uuid.UUID,
        start_date: date,
        end_date: date,
        idempotency_key: str,
        guests_total: int = 1,
        guests_adults_men: int = 0,
        guests_adults_women: int = 0,
        guests_children: int = 0,
    ) -> Booking:
        existing_result = await db.execute(
            select(Booking).where(
                Booking.user_id == user_id,
                Booking.idempotency_key == idempotency_key,
                Booking.deleted_at.is_(None),
            )
        )
        existing = existing_result.scalar_one_or_none()
        if existing:
            return existing

        if end_date <= start_date:
            raise ValueError('end_date must be greater than start_date')

        total_guests = guests_total
        known_guests = guests_adults_men + guests_adults_women + guests_children
        total_adults = guests_adults_men + guests_adults_women
        if total_guests <= 0:
            raise ValueError('Kamida 1 nafar mehmon kiritilishi kerak')
        if known_guests > total_guests:
            raise ValueError('Mehmonlar tarkibi jami mehmonlardan oshib ketdi')
        if known_guests > 0 and total_adults <= 0:
            raise ValueError('Tarkib ko‘rsatilsa, kamida 1 nafar katta yoshli mehmon bo‘lishi kerak')

        lock_key = f'lock:booking:property:{property_id}'
        async with redis_lock(lock_key, timeout_seconds=15) as acquired:
            if not acquired:
                raise ValueError('Booking in progress for this property. Retry shortly.')

            property_result = await db.execute(
                select(Property)
                .where(
                    Property.id == property_id,
                    Property.deleted_at.is_(None),
                    Property.status == PropertyStatus.ACTIVE,
                )
                .with_for_update()
            )
            property_obj = property_result.scalar_one_or_none()
            if property_obj is None:
                raise ValueError('Property not found or inactive')
            if total_guests > int(property_obj.capacity):
                raise ValueError('Mehmonlar soni uy sigimidan oshib ketdi')

            overlap_result = await db.execute(
                select(Booking)
                .where(
                    Booking.property_id == property_id,
                    Booking.deleted_at.is_(None),
                    Booking.status.in_(
                        [
                            BookingStatus.PENDING_PAYMENT,
                            BookingStatus.CONFIRMED,
                            BookingStatus.COMPLETED,
                        ]
                    ),
                    and_(Booking.start_date < end_date, Booking.end_date > start_date),
                )
                .limit(1)
            )
            overlap = overlap_result.scalars().first()
            if overlap:
                raise ValueError('Selected dates are unavailable')

            manual_block_result = await db.execute(
                select(PropertyDateBlock)
                .where(
                    PropertyDateBlock.property_id == property_id,
                    PropertyDateBlock.deleted_at.is_(None),
                    and_(PropertyDateBlock.start_date < end_date, PropertyDateBlock.end_date > start_date),
                )
                .limit(1)
            )
            manual_block = manual_block_result.scalars().first()
            if manual_block:
                raise ValueError('Selected dates are unavailable')

            nights = (end_date - start_date).days
            base_price = nights * float(property_obj.price_per_night)
            cleaning_fee = 0.0  # Fees removed as per requirements
            service_fee = 0.0
            total_price = base_price

            commission_percent = settings.default_commission_percent
            platform_commission = total_price * (commission_percent / 100)
            host_earning = total_price - platform_commission

            booking = Booking(
                booking_code=f'PH-{secrets.token_hex(5).upper()}',
                user_id=user_id,
                property_id=property_id,
                start_date=start_date,
                end_date=end_date,
                total_nights=nights,
                guests_total=guests_total,
                guests_adults_men=guests_adults_men,
                guests_adults_women=guests_adults_women,
                guests_children=guests_children,
                price_per_night_snapshot=float(property_obj.price_per_night),
                cleaning_fee_snapshot=cleaning_fee,
                service_fee_snapshot=service_fee,
                platform_commission_snapshot=platform_commission,
                host_earning_snapshot=host_earning,
                total_price=total_price,
                commission_percent_snapshot=commission_percent,
                status=BookingStatus.PENDING_PAYMENT,
                idempotency_key=idempotency_key,
                expires_at=datetime.now(timezone.utc) + timedelta(minutes=settings.booking_pending_expiry_minutes),
            )
            db.add(booking)
            await db.flush()

            db.add(
                BookingEvent(
                    booking_id=booking.id,
                    old_status=None,
                    new_status=BookingStatus.PENDING_PAYMENT,
                    event_type='booking_created_pending_payment',
                    event_payload={'idempotency_key': idempotency_key},
                )
            )

            try:
                await db.commit()
            except IntegrityError as exc:
                await db.rollback()
                existing_retry = await db.execute(
                    select(Booking).where(
                        Booking.user_id == user_id,
                        Booking.idempotency_key == idempotency_key,
                        Booking.deleted_at.is_(None),
                    )
                )
                existing_booking = existing_retry.scalar_one_or_none()
                if existing_booking:
                    return existing_booking
                raise ValueError('Booking conflict detected') from exc

            await db.refresh(booking)
            return booking

    async def get_booking(self, db: AsyncSession, booking_id: uuid.UUID) -> Booking | None:
        result = await db.execute(select(Booking).where(Booking.id == booking_id, Booking.deleted_at.is_(None)))
        return result.scalar_one_or_none()

    async def list_user_bookings(
        self,
        db: AsyncSession,
        *,
        user_id: uuid.UUID,
        limit: int,
        offset: int,
    ) -> tuple[list[Booking], int]:
        total_result = await db.execute(
            select(func.count())
            .select_from(Booking)
            .where(
                Booking.user_id == user_id,
                Booking.deleted_at.is_(None),
            )
        )
        total = int(total_result.scalar_one())

        rows_result = await db.execute(
            select(Booking)
            .where(
                Booking.user_id == user_id,
                Booking.deleted_at.is_(None),
            )
            .order_by(Booking.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        rows = list(rows_result.scalars().all())
        return rows, total

    async def cancel_booking(self, db: AsyncSession, booking: Booking, reason: str) -> Booking:
        if booking.status not in {BookingStatus.PENDING_PAYMENT, BookingStatus.CONFIRMED}:
            raise ValueError('Booking cannot be cancelled in current status')

        previous = booking.status
        booking.status = BookingStatus.CANCELLED
        booking.cancel_reason = reason
        booking.cancelled_at = datetime.now(timezone.utc)

        db.add(
            BookingEvent(
                booking_id=booking.id,
                old_status=previous,
                new_status=BookingStatus.CANCELLED,
                event_type='booking_cancelled',
                event_payload={'reason': reason},
            )
        )
        await db.commit()
        await db.refresh(booking)
        return booking
