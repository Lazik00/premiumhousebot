import asyncio
from datetime import UTC, datetime, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import select

from app.db.session import dispose_engine
from app.db.session import AsyncSessionLocal
from app.models.booking import Booking, BookingEvent
from app.models.enums import BookingStatus, PaymentProvider, PaymentStatus
from app.models.payment import Payment
from app.models.property import City, Property
from app.models.user import User
from app.services.integration_dispatcher import enqueue_booking_sheet_export
from app.services.review_service import ReviewService
from app.services.telegram_bot_service import TelegramBotService
from app.tasks.celery_app import celery_app

LOCAL_ZONE = ZoneInfo('Asia/Tashkent')


async def _expire_pending_bookings() -> int:
    async with AsyncSessionLocal() as db:
        now = datetime.now(timezone.utc)
        result = await db.execute(
            select(Booking)
            .where(
                Booking.status.in_([BookingStatus.PENDING_PAYMENT, BookingStatus.AWAITING_CONFIRMATION]),
                Booking.expires_at.is_not(None),
                Booking.expires_at < now,
                Booking.deleted_at.is_(None),
            )
            .with_for_update(skip_locked=True)
        )
        bookings = result.scalars().all()
        expired_booking_ids = []

        for booking in bookings:
            previous_status = booking.status
            booking.status = BookingStatus.EXPIRED
            expired_booking_ids.append(booking.id)
            payment_result = await db.execute(
                select(Payment).where(
                    Payment.booking_id == booking.id,
                    Payment.provider == PaymentProvider.MANUAL,
                    Payment.status == PaymentStatus.PENDING,
                    Payment.deleted_at.is_(None),
                )
            )
            for payment in payment_result.scalars().all():
                payment.status = PaymentStatus.FAILED
                payment.failed_at = now
            db.add(
                BookingEvent(
                    booking_id=booking.id,
                    old_status=previous_status,
                    new_status=BookingStatus.EXPIRED,
                    event_type='booking_expired_unpaid',
                    event_payload={'expired_at': now.isoformat()},
                )
            )

        await db.commit()
        for booking_id in expired_booking_ids:
            enqueue_booking_sheet_export(booking_id, 'booking_expired')
        return len(bookings)


async def _complete_finished_bookings() -> int:
    async with AsyncSessionLocal() as db:
        now = datetime.now(UTC)
        local_today = datetime.now(LOCAL_ZONE).date()
        result = await db.execute(
            select(Booking)
            .where(
                Booking.status == BookingStatus.CONFIRMED,
                Booking.end_date <= local_today,
                Booking.deleted_at.is_(None),
            )
            .with_for_update(skip_locked=True)
        )
        bookings = result.scalars().all()
        completed_booking_ids = []

        for booking in bookings:
            previous_status = booking.status
            booking.status = BookingStatus.COMPLETED
            booking.completed_at = now
            completed_booking_ids.append(booking.id)
            db.add(
                BookingEvent(
                    booking_id=booking.id,
                    old_status=previous_status,
                    new_status=BookingStatus.COMPLETED,
                    event_type='booking_completed_auto',
                    event_payload={'completed_at': now.isoformat()},
                )
            )

        await db.commit()
        for booking_id in completed_booking_ids:
            enqueue_booking_sheet_export(booking_id, 'booking_completed')
        return len(bookings)


async def _send_review_prompts() -> int:
    notifications = TelegramBotService()
    review_service = ReviewService()
    async with AsyncSessionLocal() as db:
        now = datetime.now(UTC)
        rows = await db.execute(
            select(Booking, User, Property, City)
            .join(User, User.id == Booking.user_id)
            .join(Property, Property.id == Booking.property_id)
            .join(City, City.id == Property.city_id)
            .where(
                Booking.status == BookingStatus.COMPLETED,
                Booking.review_prompt_sent_at.is_(None),
                Booking.deleted_at.is_(None),
                User.deleted_at.is_(None),
                User.telegram_id.is_not(None),
                Property.deleted_at.is_(None),
                City.deleted_at.is_(None),
            )
            .with_for_update(skip_locked=True)
        )
        sent_count = 0
        for booking, user, property_obj, city_obj in rows.all():
            if await review_service.has_review_for_booking(db, booking_id=booking.id):
                booking.review_prompt_sent_at = now
                continue
            locale = user.language_code if user.language_code in {'uz', 'ru', 'en'} else 'uz'
            try:
                await notifications.notifications.send_message(
                    chat_id=int(user.telegram_id),
                    text=notifications.review_prompt_text(
                        locale=locale,
                        booking_code=booking.booking_code,
                        property_title=property_obj.title,
                        city_name=city_obj.name_uz,
                    ),
                    reply_markup=notifications.review_prompt_markup(booking.id, locale),
                )
            except Exception:
                continue

            booking.review_prompt_sent_at = now
            db.add(
                BookingEvent(
                    booking_id=booking.id,
                    old_status=booking.status,
                    new_status=booking.status,
                    event_type='booking_review_prompt_sent',
                    event_payload={'sent_at': now.isoformat()},
                )
            )
            sent_count += 1

        await db.commit()
        return sent_count


@celery_app.task(name='booking.expire_pending')
def expire_pending_bookings() -> int:
    async def _runner() -> int:
        try:
            return await _expire_pending_bookings()
        finally:
            # Celery prefork workers run task coroutines on separate event loops.
            # Disposing pooled async connections avoids cross-loop reuse errors.
            await dispose_engine()

    return asyncio.run(_runner())


@celery_app.task(name='booking.complete_finished')
def complete_finished_bookings() -> int:
    async def _runner() -> int:
        try:
            return await _complete_finished_bookings()
        finally:
            await dispose_engine()

    return asyncio.run(_runner())


@celery_app.task(name='booking.send_review_prompts')
def send_review_prompts() -> int:
    async def _runner() -> int:
        try:
            return await _send_review_prompts()
        finally:
            await dispose_engine()

    return asyncio.run(_runner())
