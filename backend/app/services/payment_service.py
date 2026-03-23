import base64
import hashlib
import hmac
import json
import uuid
from datetime import datetime, timezone
from urllib.parse import urlencode

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.balance import BalanceLedgerEntry, HostBalance, PlatformBalance
from app.models.booking import Booking, BookingEvent
from app.models.enums import (
    AccountType,
    BookingStatus,
    LedgerDirection,
    PaymentProvider,
    PaymentStatus,
    TransactionType,
)
from app.models.payment import Payment, PaymentCallback, Transaction
from app.models.property import Property


class PaymentService:
    def __init__(
        self,
        click_secret: str | None,
        payme_secret: str | None,
        rahmat_secret: str | None,
        payment_public_base_url: str | None = None,
        click_checkout_url: str = 'https://my.click.uz/services/pay',
        click_service_id: str | None = None,
        click_merchant_id: str | None = None,
        click_merchant_user_id: str | None = None,
        click_return_url: str | None = None,
        click_callback_url: str | None = None,
        payme_checkout_url: str = 'https://checkout.paycom.uz',
        payme_merchant_id: str | None = None,
        payme_account_key: str = 'booking_id',
        payme_return_url: str | None = None,
        payme_callback_url: str | None = None,
        rahmat_checkout_url: str = 'https://pay.rahmat.uz/checkout',
        rahmat_merchant_id: str | None = None,
        rahmat_return_url: str | None = None,
        rahmat_callback_url: str | None = None,
    ) -> None:
        self.provider_secrets = {
            PaymentProvider.CLICK.value: click_secret,
            PaymentProvider.PAYME.value: payme_secret,
            PaymentProvider.RAHMAT.value: rahmat_secret,
        }
        self.payment_public_base_url = payment_public_base_url

        self.click_checkout_url = click_checkout_url
        self.click_service_id = click_service_id
        self.click_merchant_id = click_merchant_id
        self.click_merchant_user_id = click_merchant_user_id
        self.click_return_url = click_return_url
        self.click_callback_url = click_callback_url

        self.payme_checkout_url = payme_checkout_url
        self.payme_merchant_id = payme_merchant_id
        self.payme_account_key = payme_account_key
        self.payme_return_url = payme_return_url
        self.payme_callback_url = payme_callback_url

        self.rahmat_checkout_url = rahmat_checkout_url
        self.rahmat_merchant_id = rahmat_merchant_id
        self.rahmat_return_url = rahmat_return_url
        self.rahmat_callback_url = rahmat_callback_url

    async def create_payment_link(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        booking_id: uuid.UUID,
        provider: PaymentProvider,
        idempotency_key: str,
        request_base_url: str | None = None,
    ) -> Payment:
        existing_result = await db.execute(
            select(Payment).where(Payment.idempotency_key == idempotency_key, Payment.deleted_at.is_(None))
        )
        existing = existing_result.scalar_one_or_none()
        if existing:
            return existing

        booking_result = await db.execute(
            select(Booking).where(
                Booking.id == booking_id,
                Booking.user_id == user_id,
                Booking.deleted_at.is_(None),
            )
        )
        booking = booking_result.scalar_one_or_none()
        if booking is None:
            raise ValueError('Booking not found')
        if booking.status != BookingStatus.PENDING_PAYMENT:
            raise ValueError('Booking is not awaiting payment')

        provider_payment_id = f'{provider.value}_{uuid.uuid4().hex}'
        base_url = self._resolve_public_base_url(request_base_url)
        payment_url, provider_payload = self._build_provider_payment_link(
            provider=provider,
            booking=booking,
            provider_payment_id=provider_payment_id,
            base_url=base_url,
        )

        payment = Payment(
            booking_id=booking.id,
            provider=provider,
            provider_payment_id=provider_payment_id,
            payment_url=payment_url,
            amount=float(booking.total_price),
            currency='UZS',
            status=PaymentStatus.PENDING,
            idempotency_key=idempotency_key,
            raw_request=provider_payload,
            raw_response={'payment_url': payment_url, 'provider_payment_id': provider_payment_id},
        )
        db.add(payment)
        await db.commit()
        await db.refresh(payment)
        return payment

    async def process_callback(
        self,
        db: AsyncSession,
        provider: PaymentProvider,
        provider_event_id: str,
        payment_id: uuid.UUID,
        callback_status: str,
        payload: dict,
        signature: str,
    ) -> tuple[str, uuid.UUID | None]:
        if not self.verify_signature(provider, payload, signature):
            return 'invalid_signature', None

        existing_cb = await db.execute(
            select(PaymentCallback).where(
                PaymentCallback.provider == provider,
                PaymentCallback.provider_event_id == provider_event_id,
                PaymentCallback.deleted_at.is_(None),
            )
        )
        callback_row = existing_cb.scalar_one_or_none()
        if callback_row:
            payment_for_cb = await db.execute(
                select(Payment).where(Payment.id == callback_row.payment_id, Payment.deleted_at.is_(None))
            )
            payment_obj = payment_for_cb.scalar_one_or_none()
            return 'already_processed', payment_obj.booking_id if payment_obj else None

        callback = PaymentCallback(
            payment_id=payment_id,
            provider=provider,
            provider_event_id=provider_event_id,
            signature=signature,
            payload=payload,
            is_valid=True,
        )
        db.add(callback)
        try:
            await db.flush()
        except IntegrityError:
            await db.rollback()
            payment_for_cb = await db.execute(
                select(Payment).where(Payment.id == payment_id, Payment.deleted_at.is_(None))
            )
            payment_obj = payment_for_cb.scalar_one_or_none()
            return 'already_processed', payment_obj.booking_id if payment_obj else None

        payment_result = await db.execute(
            select(Payment).where(Payment.id == payment_id, Payment.deleted_at.is_(None)).with_for_update()
        )
        payment = payment_result.scalar_one_or_none()
        if payment is None:
            callback.processed_at = datetime.now(timezone.utc)
            await db.commit()
            return 'payment_not_found', None

        booking_result = await db.execute(
            select(Booking).where(Booking.id == payment.booking_id, Booking.deleted_at.is_(None)).with_for_update()
        )
        booking = booking_result.scalar_one_or_none()
        if booking is None:
            callback.processed_at = datetime.now(timezone.utc)
            await db.commit()
            return 'booking_not_found', None

        if callback_status == 'success':
            if payment.status == PaymentStatus.SUCCESS:
                callback.processed_at = datetime.now(timezone.utc)
                await db.commit()
                return 'already_confirmed', booking.id

            if booking.status != BookingStatus.PENDING_PAYMENT:
                callback.processed_at = datetime.now(timezone.utc)
                await db.commit()
                return 'ignored_booking_state', booking.id

            payment.status = PaymentStatus.SUCCESS
            payment.paid_at = datetime.now(timezone.utc)

            old_status = booking.status
            booking.status = BookingStatus.CONFIRMED
            booking.confirmed_at = datetime.now(timezone.utc)

            db.add(
                BookingEvent(
                    booking_id=booking.id,
                    old_status=old_status,
                    new_status=BookingStatus.CONFIRMED,
                    event_type='booking_confirmed_payment_success',
                    event_payload={'payment_id': str(payment.id), 'provider': provider.value},
                )
            )
            await self._record_financials(db=db, booking=booking, payment=payment)

            callback.processed_at = datetime.now(timezone.utc)
            await db.commit()
            return 'processed', booking.id

        payment.status = PaymentStatus.FAILED
        payment.failed_at = datetime.now(timezone.utc)

        if booking.status == BookingStatus.PENDING_PAYMENT:
            booking.status = BookingStatus.CANCELLED
            booking.cancel_reason = 'payment_failed'
            booking.cancelled_at = datetime.now(timezone.utc)
            db.add(
                BookingEvent(
                    booking_id=booking.id,
                    old_status=BookingStatus.PENDING_PAYMENT,
                    new_status=BookingStatus.CANCELLED,
                    event_type='booking_cancelled_payment_failed',
                    event_payload={'payment_id': str(payment.id), 'provider': provider.value},
                )
            )

        callback.processed_at = datetime.now(timezone.utc)
        await db.commit()
        return 'processed_failed', booking.id

    def verify_signature(self, provider: PaymentProvider, payload: dict, signature: str) -> bool:
        secret = self.provider_secrets.get(provider.value)
        if not secret:
            return False
        body = json.dumps(payload, separators=(',', ':'), sort_keys=True).encode('utf-8')
        expected = hmac.new(secret.encode('utf-8'), body, hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected, signature)

    def _resolve_public_base_url(self, request_base_url: str | None) -> str:
        if self.payment_public_base_url:
            return self.payment_public_base_url.rstrip('/')
        if request_base_url:
            return request_base_url.rstrip('/')
        raise ValueError('Payment public base URL is not configured')

    def _build_provider_payment_link(
        self,
        *,
        provider: PaymentProvider,
        booking: Booking,
        provider_payment_id: str,
        base_url: str,
    ) -> tuple[str, dict]:
        if provider == PaymentProvider.CLICK:
            return self._build_click_link(booking=booking, provider_payment_id=provider_payment_id, base_url=base_url)
        if provider == PaymentProvider.PAYME:
            return self._build_payme_link(booking=booking, provider_payment_id=provider_payment_id, base_url=base_url)
        if provider == PaymentProvider.RAHMAT:
            return self._build_rahmat_link(booking=booking, provider_payment_id=provider_payment_id, base_url=base_url)
        raise ValueError('Unsupported payment provider')

    def _build_click_link(self, *, booking: Booking, provider_payment_id: str, base_url: str) -> tuple[str, dict]:
        return_url = self.click_return_url or f'{base_url}/bookings'
        callback_url = self.click_callback_url or f'{base_url}/api/v1/payments/callback/click'
        service_id = self.click_service_id or 'demo_service'
        merchant_id = self.click_merchant_id or 'demo_merchant'
        params = {
            'service_id': service_id,
            'merchant_id': merchant_id,
            'amount': f'{float(booking.total_price):.2f}',
            'transaction_param': str(booking.id),
            'merchant_trans_id': provider_payment_id,
            'return_url': return_url,
        }
        if self.click_merchant_user_id:
            params['merchant_user_id'] = self.click_merchant_user_id
        payment_url = f'{self.click_checkout_url.rstrip("/")}?' + urlencode(params)
        payload = {
            'provider': 'click',
            'booking_id': str(booking.id),
            'provider_payment_id': provider_payment_id,
            'amount': float(booking.total_price),
            'return_url': return_url,
            'callback_url': callback_url,
            'checkout_url': self.click_checkout_url,
            'params': params,
        }
        return payment_url, payload

    def _build_payme_link(self, *, booking: Booking, provider_payment_id: str, base_url: str) -> tuple[str, dict]:
        return_url = self.payme_return_url or f'{base_url}/bookings'
        callback_url = self.payme_callback_url or f'{base_url}/api/v1/payments/callback/payme'
        amount_tiyin = int(round(float(booking.total_price) * 100))
        account_key = self.payme_account_key.strip() or 'booking_id'
        merchant_id = self.payme_merchant_id or 'demo_merchant'
        payme_payload: dict[str, str | int] = {
            'm': merchant_id,
            'a': amount_tiyin,
            'l': 'uz',
            'c': return_url,
            f'ac.{account_key}': str(booking.id),
            'ac.provider_payment_id': provider_payment_id,
        }
        encoded = base64.b64encode(
            json.dumps(payme_payload, separators=(',', ':'), ensure_ascii=False).encode('utf-8')
        ).decode('utf-8')
        payment_url = f'{self.payme_checkout_url.rstrip("/")}/{encoded}'
        payload = {
            'provider': 'payme',
            'booking_id': str(booking.id),
            'provider_payment_id': provider_payment_id,
            'amount_tiyin': amount_tiyin,
            'return_url': return_url,
            'callback_url': callback_url,
            'checkout_url': self.payme_checkout_url,
            'params': payme_payload,
        }
        return payment_url, payload

    def _build_rahmat_link(self, *, booking: Booking, provider_payment_id: str, base_url: str) -> tuple[str, dict]:
        return_url = self.rahmat_return_url or f'{base_url}/bookings'
        callback_url = self.rahmat_callback_url or f'{base_url}/api/v1/payments/callback/rahmat'
        merchant_id = self.rahmat_merchant_id or 'demo_merchant'
        params = {
            'merchant_id': merchant_id,
            'order_id': provider_payment_id,
            'account_id': str(booking.id),
            'amount': f'{float(booking.total_price):.2f}',
            'currency': 'UZS',
            'return_url': return_url,
            'callback_url': callback_url,
        }
        payment_url = f'{self.rahmat_checkout_url.rstrip("/")}?' + urlencode(params)
        payload = {
            'provider': 'rahmat',
            'booking_id': str(booking.id),
            'provider_payment_id': provider_payment_id,
            'amount': float(booking.total_price),
            'return_url': return_url,
            'callback_url': callback_url,
            'checkout_url': self.rahmat_checkout_url,
            'params': params,
        }
        return payment_url, payload

    async def _record_financials(self, db: AsyncSession, booking: Booking, payment: Payment) -> None:
        property_result = await db.execute(select(Property).where(Property.id == booking.property_id, Property.deleted_at.is_(None)))
        property_obj = property_result.scalar_one()

        payment_in = Transaction(
            booking_id=booking.id,
            payment_id=payment.id,
            txn_type=TransactionType.PAYMENT_IN,
            amount=float(booking.total_price),
            currency='UZS',
            provider_reference=payment.provider_payment_id,
            txn_metadata={'provider': payment.provider.value},
        )
        commission_txn = Transaction(
            booking_id=booking.id,
            payment_id=payment.id,
            txn_type=TransactionType.COMMISSION,
            amount=float(booking.platform_commission_snapshot),
            currency='UZS',
            provider_reference=payment.provider_payment_id,
            txn_metadata={},
        )
        host_txn = Transaction(
            booking_id=booking.id,
            payment_id=payment.id,
            txn_type=TransactionType.HOST_EARNING,
            amount=float(booking.host_earning_snapshot),
            currency='UZS',
            provider_reference=payment.provider_payment_id,
            txn_metadata={'host_id': str(property_obj.host_id)},
        )
        db.add_all([payment_in, commission_txn, host_txn])
        await db.flush()

        platform_balance_result = await db.execute(
            select(PlatformBalance).where(PlatformBalance.currency == 'UZS', PlatformBalance.deleted_at.is_(None))
        )
        platform_balance = platform_balance_result.scalar_one_or_none()
        if platform_balance is None:
            platform_balance = PlatformBalance(currency='UZS', available_amount=0, pending_amount=0)
            db.add(platform_balance)
            await db.flush()

        host_balance_result = await db.execute(
            select(HostBalance).where(
                HostBalance.host_id == property_obj.host_id,
                HostBalance.currency == 'UZS',
                HostBalance.deleted_at.is_(None),
            )
        )
        host_balance = host_balance_result.scalar_one_or_none()
        if host_balance is None:
            host_balance = HostBalance(
                host_id=property_obj.host_id,
                currency='UZS',
                available_amount=0,
                pending_amount=0,
                total_earned_amount=0,
                total_paid_out_amount=0,
            )
            db.add(host_balance)
            await db.flush()

        platform_balance.available_amount = float(platform_balance.available_amount) + float(booking.platform_commission_snapshot)
        host_balance.pending_amount = float(host_balance.pending_amount) + float(booking.host_earning_snapshot)
        host_balance.total_earned_amount = float(host_balance.total_earned_amount) + float(booking.host_earning_snapshot)

        db.add_all(
            [
                BalanceLedgerEntry(
                    account_type=AccountType.PLATFORM,
                    account_id=platform_balance.id,
                    booking_id=booking.id,
                    payment_id=payment.id,
                    transaction_id=commission_txn.id,
                    direction=LedgerDirection.CREDIT,
                    amount=float(booking.platform_commission_snapshot),
                    currency='UZS',
                    description='Platform commission from booking confirmation',
                    reference_type='booking',
                    reference_id=str(booking.id),
                ),
                BalanceLedgerEntry(
                    account_type=AccountType.HOST,
                    account_id=host_balance.id,
                    booking_id=booking.id,
                    payment_id=payment.id,
                    transaction_id=host_txn.id,
                    direction=LedgerDirection.CREDIT,
                    amount=float(booking.host_earning_snapshot),
                    currency='UZS',
                    description='Host earning from booking confirmation',
                    reference_type='booking',
                    reference_id=str(booking.id),
                ),
            ]
        )
