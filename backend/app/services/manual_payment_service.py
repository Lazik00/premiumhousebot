import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.booking import Booking, BookingEvent
from app.models.enums import BookingStatus, PaymentProvider, PaymentStatus
from app.models.payment import ManualPaymentMethod, Payment
from app.models.property import City, Property, Region
from app.models.user import User
from app.services.integration_dispatcher import enqueue_booking_sheet_export
from app.services.payment_service import PaymentService
from app.services.telegram_notification_service import TelegramNotificationService


class ManualPaymentService:
    def __init__(self) -> None:
        self.payment_service = PaymentService(
            click_secret=settings.click_secret,
            payme_secret=settings.payme_secret,
            rahmat_secret=settings.rahmat_secret,
            payment_public_base_url=settings.payment_public_base_url,
            click_checkout_url=settings.click_checkout_url,
            click_service_id=settings.click_service_id,
            click_merchant_id=settings.click_merchant_id,
            click_merchant_user_id=settings.click_merchant_user_id,
            click_return_url=settings.click_return_url,
            click_callback_url=settings.click_callback_url,
            payme_checkout_url=settings.payme_checkout_url,
            payme_merchant_id=settings.payme_merchant_id,
            payme_account_key=settings.payme_account_key,
            payme_return_url=settings.payme_return_url,
            payme_callback_url=settings.payme_callback_url,
            rahmat_checkout_url=settings.rahmat_checkout_url,
            rahmat_merchant_id=settings.rahmat_merchant_id,
            rahmat_return_url=settings.rahmat_return_url,
            rahmat_callback_url=settings.rahmat_callback_url,
            octo_prepare_url=settings.octo_prepare_url,
            octo_status_url=settings.octo_status_url,
            octo_refund_url=settings.octo_refund_url,
            octo_shop_id=settings.octo_shop_id,
            octo_secret=settings.octo_secret,
            octo_unique_key=settings.octo_unique_key,
            octo_return_url=settings.octo_return_url,
            octo_notify_url=settings.octo_notify_url,
            octo_auto_capture=settings.octo_auto_capture,
            octo_test_mode=settings.octo_test_mode,
            octo_ttl_minutes=settings.octo_ttl_minutes,
            octo_language=settings.octo_language,
            octo_payment_methods=settings.octo_payment_method_list,
        )
        self.notifications = TelegramNotificationService(settings.telegram_bot_token)

    async def list_active_methods(self, db: AsyncSession) -> list[ManualPaymentMethod]:
        rows = await db.execute(
            select(ManualPaymentMethod)
            .where(
                ManualPaymentMethod.deleted_at.is_(None),
                ManualPaymentMethod.is_active.is_(True),
            )
            .order_by(ManualPaymentMethod.sort_order.asc(), ManualPaymentMethod.created_at.asc())
        )
        return list(rows.scalars().all())

    async def list_methods(self, db: AsyncSession) -> list[ManualPaymentMethod]:
        rows = await db.execute(
            select(ManualPaymentMethod)
            .where(ManualPaymentMethod.deleted_at.is_(None))
            .order_by(ManualPaymentMethod.sort_order.asc(), ManualPaymentMethod.created_at.asc())
        )
        return list(rows.scalars().all())

    async def create_method(
        self,
        db: AsyncSession,
        *,
        brand: str,
        name: str,
        card_holder: str,
        card_number: str,
        instructions: str | None,
        is_active: bool,
        sort_order: int,
    ) -> ManualPaymentMethod:
        method = ManualPaymentMethod(
            brand=brand,
            name=name.strip(),
            card_holder=card_holder.strip(),
            card_number=card_number.strip(),
            instructions=instructions.strip() if instructions else None,
            is_active=is_active,
            sort_order=sort_order,
        )
        db.add(method)
        await db.commit()
        await db.refresh(method)
        return method

    async def update_method(
        self,
        db: AsyncSession,
        *,
        method_id: uuid.UUID,
        brand: str,
        name: str,
        card_holder: str,
        card_number: str,
        instructions: str | None,
        is_active: bool,
        sort_order: int,
    ) -> ManualPaymentMethod:
        result = await db.execute(
            select(ManualPaymentMethod)
            .where(ManualPaymentMethod.id == method_id, ManualPaymentMethod.deleted_at.is_(None))
        )
        method = result.scalar_one_or_none()
        if method is None:
            raise ValueError('Payment method not found')

        method.brand = brand
        method.name = name.strip()
        method.card_holder = card_holder.strip()
        method.card_number = card_number.strip()
        method.instructions = instructions.strip() if instructions else None
        method.is_active = is_active
        method.sort_order = sort_order
        await db.commit()
        await db.refresh(method)
        return method

    async def submit_manual_payment(
        self,
        db: AsyncSession,
        *,
        booking_id: uuid.UUID,
        user_id: uuid.UUID,
        payment_method_id: uuid.UUID,
        idempotency_key: str,
        note: str | None,
    ) -> tuple[Booking, Payment]:
        method_result = await db.execute(
            select(ManualPaymentMethod)
            .where(
                ManualPaymentMethod.id == payment_method_id,
                ManualPaymentMethod.deleted_at.is_(None),
                ManualPaymentMethod.is_active.is_(True),
            )
        )
        method = method_result.scalar_one_or_none()
        if method is None:
            raise ValueError('Payment method not found')

        existing_result = await db.execute(
            select(Payment)
            .join(Booking, Booking.id == Payment.booking_id)
            .where(
                Payment.booking_id == booking_id,
                Payment.provider == PaymentProvider.MANUAL,
                Payment.idempotency_key == idempotency_key,
                Payment.deleted_at.is_(None),
                Booking.user_id == user_id,
                Booking.deleted_at.is_(None),
            )
        )
        existing = existing_result.scalar_one_or_none()
        if existing is not None:
            booking_result = await db.execute(
                select(Booking).where(Booking.id == existing.booking_id, Booking.deleted_at.is_(None))
            )
            booking = booking_result.scalar_one()
            return booking, existing

        booking_result = await db.execute(
            select(Booking)
            .where(
                Booking.id == booking_id,
                Booking.user_id == user_id,
                Booking.deleted_at.is_(None),
            )
            .with_for_update()
        )
        booking = booking_result.scalar_one_or_none()
        if booking is None:
            raise ValueError('Booking not found')
        if booking.status == BookingStatus.AWAITING_CONFIRMATION:
            pending_payment = await self._latest_manual_payment(db, booking.id, {PaymentStatus.PENDING})
            if pending_payment is None:
                raise ValueError('Booking already submitted for review')
            return booking, pending_payment
        if booking.status != BookingStatus.PENDING_PAYMENT:
            raise ValueError('Booking is not awaiting manual payment')
        if booking.expires_at and booking.expires_at <= datetime.now(UTC):
            raise ValueError('Booking payment window expired')

        payment = Payment(
            booking_id=booking.id,
            payment_method_id=method.id,
            provider=PaymentProvider.MANUAL,
            provider_payment_id=None,
            payment_url=None,
            amount=float(booking.total_price),
            currency='UZS',
            status=PaymentStatus.PENDING,
            idempotency_key=idempotency_key,
            raw_request={
                'payment_method': self._payment_method_snapshot(method),
                'customer_note': note.strip() if note else None,
                'submitted_at': datetime.now(UTC).isoformat(),
            },
            raw_response={},
        )
        db.add(payment)

        previous_status = booking.status
        booking.status = BookingStatus.AWAITING_CONFIRMATION
        db.add(
            BookingEvent(
                booking_id=booking.id,
                old_status=previous_status,
                new_status=BookingStatus.AWAITING_CONFIRMATION,
                event_type='manual_payment_submitted',
                event_payload={
                    'payment_method_id': str(method.id),
                    'payment_method_name': method.name,
                    'payment_method_brand': method.brand,
                    'customer_note': note.strip() if note else None,
                },
            )
        )

        try:
            await db.commit()
        except IntegrityError:
            await db.rollback()
            existing_retry = await db.execute(
                select(Payment)
                .where(
                    Payment.booking_id == booking_id,
                    Payment.provider == PaymentProvider.MANUAL,
                    Payment.idempotency_key == idempotency_key,
                    Payment.deleted_at.is_(None),
                )
            )
            existing_payment = existing_retry.scalar_one_or_none()
            if existing_payment is None:
                raise
            booking_retry = await db.execute(
                select(Booking).where(Booking.id == booking_id, Booking.deleted_at.is_(None))
            )
            return booking_retry.scalar_one(), existing_payment

        await db.refresh(booking)
        await db.refresh(payment)
        enqueue_booking_sheet_export(booking.id, 'manual_payment_submitted')
        return booking, payment

    async def approve_manual_payment(
        self,
        db: AsyncSession,
        *,
        booking_id: uuid.UUID,
        reviewer_note: str | None,
    ) -> tuple[Booking, Payment]:
        booking_result = await db.execute(
            select(Booking)
            .where(Booking.id == booking_id, Booking.deleted_at.is_(None))
            .with_for_update()
        )
        booking = booking_result.scalar_one_or_none()
        if booking is None:
            raise ValueError('Booking not found')
        if booking.status != BookingStatus.AWAITING_CONFIRMATION:
            raise ValueError('Booking is not awaiting admin confirmation')

        payment = await self._latest_manual_payment(db, booking.id, {PaymentStatus.PENDING})
        if payment is None:
            raise ValueError('Pending manual payment not found')

        property_row = await self._load_booking_property(db, booking.property_id)
        user_row = await self._load_booking_user(db, booking.user_id)

        payment.status = PaymentStatus.SUCCESS
        payment.paid_at = datetime.now(UTC)
        payment.raw_response = {
            **(payment.raw_response or {}),
            'review_note': reviewer_note.strip() if reviewer_note else None,
            'approved_at': datetime.now(UTC).isoformat(),
        }

        previous_status = booking.status
        booking.status = BookingStatus.CONFIRMED
        booking.confirmed_at = datetime.now(UTC)
        db.add(
            BookingEvent(
                booking_id=booking.id,
                old_status=previous_status,
                new_status=BookingStatus.CONFIRMED,
                event_type='booking_confirmed_manual_review',
                event_payload={
                    'payment_id': str(payment.id),
                    'review_note': reviewer_note.strip() if reviewer_note else None,
                },
            )
        )
        await self.payment_service._record_financials(db=db, booking=booking, payment=payment)
        await db.commit()
        await db.refresh(booking)
        await db.refresh(payment)
        enqueue_booking_sheet_export(booking.id, 'booking_confirmed_manual')

        if user_row.telegram_id:
            property_obj, city_obj, _region_obj = property_row
            try:
                await self.notifications.send_booking_confirmed(
                    telegram_id=user_row.telegram_id,
                    booking_code=booking.booking_code,
                    property_title=property_obj.title,
                    property_address=property_obj.address,
                    city_name=city_obj.name_uz,
                    start_date=booking.start_date,
                    end_date=booking.end_date,
                    total_nights=booking.total_nights,
                    guests_total=booking.guests_total,
                    total_price=float(booking.total_price),
                    currency='UZS',
                )
            except Exception:
                pass

        return booking, payment

    async def reject_manual_payment(
        self,
        db: AsyncSession,
        *,
        booking_id: uuid.UUID,
        reviewer_note: str | None,
    ) -> tuple[Booking, Payment]:
        booking_result = await db.execute(
            select(Booking)
            .where(Booking.id == booking_id, Booking.deleted_at.is_(None))
            .with_for_update()
        )
        booking = booking_result.scalar_one_or_none()
        if booking is None:
            raise ValueError('Booking not found')
        if booking.status != BookingStatus.AWAITING_CONFIRMATION:
            raise ValueError('Booking is not awaiting admin confirmation')

        payment = await self._latest_manual_payment(db, booking.id, {PaymentStatus.PENDING})
        if payment is None:
            raise ValueError('Pending manual payment not found')

        now = datetime.now(UTC)
        payment.status = PaymentStatus.FAILED
        payment.failed_at = now
        payment.raw_response = {
            **(payment.raw_response or {}),
            'review_note': reviewer_note.strip() if reviewer_note else None,
            'rejected_at': now.isoformat(),
        }

        previous_status = booking.status
        next_status = BookingStatus.CANCELLED if not (booking.expires_at and booking.expires_at <= now) else BookingStatus.EXPIRED
        booking.status = next_status
        booking.cancelled_at = now if next_status == BookingStatus.CANCELLED else booking.cancelled_at
        booking.cancel_reason = reviewer_note.strip() if reviewer_note else 'Admin rejected manual payment'
        db.add(
            BookingEvent(
                booking_id=booking.id,
                old_status=previous_status,
                new_status=next_status,
                event_type='manual_payment_rejected',
                event_payload={
                    'payment_id': str(payment.id),
                    'review_note': reviewer_note.strip() if reviewer_note else None,
                    'cancelled': next_status == BookingStatus.CANCELLED,
                },
            )
        )
        await db.commit()
        await db.refresh(booking)
        await db.refresh(payment)
        if booking.status == BookingStatus.CANCELLED:
            enqueue_booking_sheet_export(booking.id, 'booking_cancelled_manual_rejected')
        elif booking.status == BookingStatus.EXPIRED:
            enqueue_booking_sheet_export(booking.id, 'booking_expired_manual_rejected')
        return booking, payment

    async def _latest_manual_payment(
        self,
        db: AsyncSession,
        booking_id: uuid.UUID,
        statuses: set[PaymentStatus] | None = None,
    ) -> Payment | None:
        stmt = (
            select(Payment)
            .where(
                Payment.booking_id == booking_id,
                Payment.provider == PaymentProvider.MANUAL,
                Payment.deleted_at.is_(None),
            )
            .order_by(Payment.created_at.desc())
            .with_for_update()
        )
        if statuses:
            stmt = stmt.where(Payment.status.in_(list(statuses)))
        result = await db.execute(stmt)
        return result.scalars().first()

    async def _load_booking_property(self, db: AsyncSession, property_id: uuid.UUID) -> tuple[Property, City, Region]:
        result = await db.execute(
            select(Property, City, Region)
            .join(City, City.id == Property.city_id)
            .join(Region, Region.id == Property.region_id)
            .where(
                Property.id == property_id,
                Property.deleted_at.is_(None),
                City.deleted_at.is_(None),
                Region.deleted_at.is_(None),
            )
        )
        row = result.one_or_none()
        if row is None:
            raise ValueError('Property not found')
        return row

    async def _load_booking_user(self, db: AsyncSession, user_id: uuid.UUID) -> User:
        result = await db.execute(select(User).where(User.id == user_id, User.deleted_at.is_(None)))
        user = result.scalar_one_or_none()
        if user is None:
            raise ValueError('User not found')
        return user

    @staticmethod
    def _payment_method_snapshot(method: ManualPaymentMethod) -> dict[str, str]:
        return {
            'id': str(method.id),
            'brand': method.brand,
            'name': method.name,
            'card_holder': method.card_holder,
            'card_number': method.card_number,
            'instructions': method.instructions or '',
        }
