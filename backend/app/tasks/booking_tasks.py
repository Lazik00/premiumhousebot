import asyncio
from datetime import datetime, timezone

from sqlalchemy import select

from app.db.session import dispose_engine
from app.db.session import AsyncSessionLocal
from app.models.booking import Booking, BookingEvent
from app.models.enums import BookingStatus, PaymentProvider, PaymentStatus
from app.models.payment import Payment
from app.tasks.celery_app import celery_app


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

        for booking in bookings:
            previous_status = booking.status
            booking.status = BookingStatus.EXPIRED
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
        return len(bookings)


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
