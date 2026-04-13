import base64
import hashlib
import hmac
import json
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from urllib.parse import urlencode

import httpx
from sqlalchemy import func, select
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
    RefundStatus,
    TransactionType,
)
from app.models.payment import Payment, PaymentCallback, Refund, Transaction
from app.models.property import Property
from app.services.integration_dispatcher import enqueue_booking_sheet_export


@dataclass(slots=True)
class PreparedPayment:
    provider_payment_id: str
    payment_url: str
    request_payload: dict
    response_payload: dict


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
        octo_prepare_url: str = 'https://secure.octo.uz/prepare_payment',
        octo_status_url: str = 'https://secure.octo.uz/prepare_payment',
        octo_refund_url: str = 'https://secure.octo.uz/refund',
        octo_shop_id: int | None = None,
        octo_secret: str | None = None,
        octo_unique_key: str | None = None,
        octo_return_url: str | None = None,
        octo_notify_url: str | None = None,
        octo_auto_capture: bool = True,
        octo_test_mode: bool = False,
        octo_ttl_minutes: int = 15,
        octo_language: str = 'uz',
        octo_payment_methods: list[str] | None = None,
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

        self.octo_prepare_url = octo_prepare_url
        self.octo_status_url = octo_status_url
        self.octo_refund_url = octo_refund_url
        self.octo_shop_id = octo_shop_id
        self.octo_secret = octo_secret
        self.octo_unique_key = octo_unique_key
        self.octo_return_url = octo_return_url
        self.octo_notify_url = octo_notify_url
        self.octo_auto_capture = octo_auto_capture
        self.octo_test_mode = octo_test_mode
        self.octo_ttl_minutes = octo_ttl_minutes
        self.octo_language = octo_language
        self.octo_payment_methods = octo_payment_methods or ['bank_card', 'uzcard', 'humo']

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
            select(Payment)
            .join(Booking, Booking.id == Payment.booking_id)
            .where(
                Payment.booking_id == booking_id,
                Payment.provider == provider,
                Payment.idempotency_key == idempotency_key,
                Payment.deleted_at.is_(None),
                Booking.user_id == user_id,
                Booking.deleted_at.is_(None),
            )
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

        merchant_transaction_id = f'{provider.value}_{uuid.uuid4().hex}'
        base_url = self._resolve_public_base_url(request_base_url)
        prepared = await self._prepare_provider_payment(
            provider=provider,
            booking=booking,
            merchant_transaction_id=merchant_transaction_id,
            base_url=base_url,
        )

        payment = Payment(
            booking_id=booking.id,
            provider=provider,
            provider_payment_id=prepared.provider_payment_id,
            payment_url=prepared.payment_url,
            amount=float(booking.total_price),
            currency='UZS',
            status=PaymentStatus.PENDING,
            idempotency_key=idempotency_key,
            raw_request=prepared.request_payload,
            raw_response=prepared.response_payload,
        )
        db.add(payment)
        try:
            await db.commit()
        except IntegrityError:
            await db.rollback()
            existing_retry = await db.execute(
                select(Payment)
                .where(
                    Payment.booking_id == booking_id,
                    Payment.provider == provider,
                    Payment.idempotency_key == idempotency_key,
                    Payment.deleted_at.is_(None),
                )
            )
            existing_payment = existing_retry.scalar_one_or_none()
            if existing_payment:
                return existing_payment
            raise
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
        if provider == PaymentProvider.OCTO:
            raise ValueError('Use process_octo_callback for Octo notifications')
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
            booking_id = await self._callback_booking_id(db, callback_row.payment_id)
            return 'already_processed', booking_id

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
        return await self._apply_callback_transition(
            db=db,
            provider=provider,
            payment=payment,
            callback=callback,
            callback_status=self._normalize_generic_callback_status(callback_status),
        )

    async def process_octo_callback(self, db: AsyncSession, payload: dict) -> tuple[str, uuid.UUID | None]:
        provider = PaymentProvider.OCTO
        provider_event_id = str(payload.get('octo_payment_UUID') or '').strip()
        signature = str(payload.get('signature') or '').strip()
        if not provider_event_id:
            return 'payment_not_found', None
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
            booking_id = await self._callback_booking_id(db, callback_row.payment_id)
            return 'already_processed', booking_id

        payment = await self._find_octo_payment_for_callback(db=db, payload=payload)
        verified_response = await self._verify_octo_callback_status(payload)
        verified_data = verified_response.get('data') or {}
        if payment is not None:
            payment.raw_response = {**(payment.raw_response or {}), 'status_check': verified_response}
        callback = PaymentCallback(
            payment_id=payment.id if payment else None,
            provider=provider,
            provider_event_id=provider_event_id,
            signature=signature,
            payload={**payload, 'verified_status_payload': verified_response},
            is_valid=True,
        )
        db.add(callback)
        try:
            await db.flush()
        except IntegrityError:
            await db.rollback()
            return 'already_processed', payment.booking_id if payment else None

        return await self._apply_callback_transition(
            db=db,
            provider=provider,
            payment=payment,
            callback=callback,
            callback_status=self._normalize_octo_callback_status(str(verified_data.get('status') or payload.get('status') or '')),
        )

    async def get_octo_payment_status(self, booking_reference: str) -> dict:
        self._require_octo_credentials()
        request_payload = {
            'octo_shop_id': self.octo_shop_id,
            'octo_secret': self.octo_secret,
            'shop_transaction_id': booking_reference,
        }
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(self.octo_status_url, json=request_payload)
            response.raise_for_status()
            return response.json()

    async def _verify_octo_callback_status(self, payload: dict) -> dict:
        shop_transaction_id = str(payload.get('shop_transaction_id') or '').strip()
        if not shop_transaction_id:
            raise RuntimeError('Octo callback does not include shop_transaction_id')

        try:
            verified_response = await self.get_octo_payment_status(shop_transaction_id)
        except httpx.HTTPError as exc:
            raise RuntimeError('Octo status verification request failed') from exc

        if int(verified_response.get('error', -1)) != 0:
            raise RuntimeError(verified_response.get('errMessage') or 'Octo status verification failed')

        verified_data = verified_response.get('data') or {}
        callback_uuid = str(payload.get('octo_payment_UUID') or '').strip()
        verified_uuid = str(verified_data.get('octo_payment_UUID') or '').strip()
        if callback_uuid and verified_uuid and callback_uuid != verified_uuid:
            raise RuntimeError('Octo callback payment UUID mismatch')
        return verified_response

    async def refund_payment(
        self,
        db: AsyncSession,
        *,
        payment_id: uuid.UUID,
        requested_by: uuid.UUID,
        amount: float | None,
        reason: str | None,
        idempotency_key: str,
    ) -> Refund:
        existing_refund_result = await db.execute(
            select(Refund).where(Refund.idempotency_key == idempotency_key, Refund.deleted_at.is_(None))
        )
        existing_refund = existing_refund_result.scalar_one_or_none()
        if existing_refund:
            return existing_refund

        payment_result = await db.execute(
            select(Payment).where(Payment.id == payment_id, Payment.deleted_at.is_(None)).with_for_update()
        )
        payment = payment_result.scalar_one_or_none()
        if payment is None:
            raise ValueError('Payment not found')
        if payment.provider != PaymentProvider.OCTO:
            raise ValueError('Refund endpoint is currently implemented only for Octo payments')
        if payment.status not in {PaymentStatus.SUCCESS, PaymentStatus.PARTIAL_REFUNDED}:
            raise ValueError('Only successful Octo payments can be refunded')
        if not payment.provider_payment_id:
            raise ValueError('Octo payment UUID is missing')

        booking_result = await db.execute(
            select(Booking).where(Booking.id == payment.booking_id, Booking.deleted_at.is_(None)).with_for_update()
        )
        booking = booking_result.scalar_one_or_none()
        if booking is None:
            raise ValueError('Booking not found')

        already_refunded_result = await db.execute(
            select(func.coalesce(func.sum(Refund.amount), 0))
            .where(
                Refund.payment_id == payment.id,
                Refund.deleted_at.is_(None),
                Refund.status.in_([RefundStatus.SUCCESS, RefundStatus.PARTIAL]),
            )
        )
        already_refunded = float(already_refunded_result.scalar_one() or 0)
        remaining_amount = max(float(payment.amount) - already_refunded, 0.0)
        if remaining_amount <= 0:
            raise ValueError('Payment has already been fully refunded')

        refund_amount = round(amount if amount is not None else remaining_amount, 2)
        if refund_amount <= 0:
            raise ValueError('Refund amount must be greater than zero')
        if refund_amount > remaining_amount:
            raise ValueError('Refund amount exceeds remaining refundable amount')

        shop_refund_id = self._build_octo_refund_id(idempotency_key)
        request_payload = {
            'octo_shop_id': self.octo_shop_id,
            'shop_refund_id': shop_refund_id,
            'octo_secret': self.octo_secret,
            'octo_payment_UUID': payment.provider_payment_id,
            'amount': refund_amount,
        }

        self._require_octo_credentials()
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.post(self.octo_refund_url, json=request_payload)
                response.raise_for_status()
                response_payload = response.json()
        except httpx.HTTPError as exc:
            raise ValueError('Octo refund request failed') from exc

        if int(response_payload.get('error', -1)) != 0:
            raise ValueError(response_payload.get('errMessage') or response_payload.get('errorMessage') or 'Octo refund failed')

        refund_data = response_payload.get('data') or {}
        refund_status = self._normalize_local_refund_status(
            provider_status=str(refund_data.get('status') or ''),
            refund_amount=refund_amount,
            remaining_amount=remaining_amount,
        )
        refund = Refund(
            booking_id=booking.id,
            payment_id=payment.id,
            provider=PaymentProvider.OCTO,
            amount=refund_amount,
            status=refund_status,
            reason=reason,
            provider_refund_id=str(refund_data.get('refund_id') or '').strip() or None,
            idempotency_key=idempotency_key,
            requested_by=requested_by,
            processed_at=self._parse_octo_datetime(str(refund_data.get('refund_time') or '')),
        )
        db.add(refund)
        await db.flush()

        payment.raw_response = {
            **(payment.raw_response or {}),
            'last_refund': response_payload,
        }

        if refund.status in {RefundStatus.SUCCESS, RefundStatus.PARTIAL}:
            await self._record_refund_financials(
                db=db,
                booking=booking,
                payment=payment,
                refund=refund,
                refund_amount=refund_amount,
                original_payment_amount=float(payment.amount),
            )

        await db.commit()
        if booking.status == BookingStatus.CANCELLED:
            enqueue_booking_sheet_export(booking.id, 'booking_cancelled_refunded')
        await db.refresh(refund)
        return refund

    def verify_signature(self, provider: PaymentProvider, payload: dict, signature: str) -> bool:
        if provider == PaymentProvider.OCTO:
            return self._verify_octo_signature(payload=payload, signature=signature)

        secret = self.provider_secrets.get(provider.value)
        if not secret:
            return False
        body = json.dumps(payload, separators=(',', ':'), sort_keys=True).encode('utf-8')
        expected = hmac.new(secret.encode('utf-8'), body, hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected, signature)

    def _verify_octo_signature(self, *, payload: dict, signature: str) -> bool:
        if not self.octo_unique_key:
            return False
        octo_payment_uuid = str(payload.get('octo_payment_UUID') or '').strip()
        callback_status = str(payload.get('status') or '').strip()
        provided_hash_key = str(payload.get('hash_key') or '').strip()
        if not signature or not octo_payment_uuid or not callback_status:
            return False
        if provided_hash_key and provided_hash_key != self.octo_unique_key:
            return False

        # Based on Octo official callback docs, the signature is inferred as
        # SHA1(unique_key + octo_payment_UUID + status).
        raw = f'{self.octo_unique_key}{octo_payment_uuid}{callback_status}'.encode('utf-8')
        expected = hashlib.sha1(raw).hexdigest().upper()
        return hmac.compare_digest(expected, signature.upper())

    def _resolve_public_base_url(self, request_base_url: str | None) -> str:
        if self.payment_public_base_url:
            return self.payment_public_base_url.rstrip('/')
        if request_base_url:
            return request_base_url.rstrip('/')
        raise ValueError('Payment public base URL is not configured')

    async def _prepare_provider_payment(
        self,
        *,
        provider: PaymentProvider,
        booking: Booking,
        merchant_transaction_id: str,
        base_url: str,
    ) -> PreparedPayment:
        if provider == PaymentProvider.CLICK:
            return self._build_click_link(booking=booking, merchant_transaction_id=merchant_transaction_id, base_url=base_url)
        if provider == PaymentProvider.PAYME:
            return self._build_payme_link(booking=booking, merchant_transaction_id=merchant_transaction_id, base_url=base_url)
        if provider == PaymentProvider.RAHMAT:
            return self._build_rahmat_link(booking=booking, merchant_transaction_id=merchant_transaction_id, base_url=base_url)
        if provider == PaymentProvider.OCTO:
            return await self._prepare_octo_payment(
                booking=booking,
                merchant_transaction_id=merchant_transaction_id,
                base_url=base_url,
            )
        raise ValueError('Unsupported payment provider')

    def _build_click_link(self, *, booking: Booking, merchant_transaction_id: str, base_url: str) -> PreparedPayment:
        if not self.click_service_id or not self.click_merchant_id:
            raise ValueError('Click merchant credentials are not configured')
        return_url = self.click_return_url or f'{base_url}/bookings'
        callback_url = self.click_callback_url or f'{base_url}/api/v1/payments/callback/click'
        params = {
            'service_id': self.click_service_id,
            'merchant_id': self.click_merchant_id,
            'amount': f'{float(booking.total_price):.2f}',
            'transaction_param': str(booking.id),
            'merchant_trans_id': merchant_transaction_id,
            'return_url': return_url,
        }
        if self.click_merchant_user_id:
            params['merchant_user_id'] = self.click_merchant_user_id
        payment_url = f'{self.click_checkout_url.rstrip("/")}?{urlencode(params)}'
        return PreparedPayment(
            provider_payment_id=merchant_transaction_id,
            payment_url=payment_url,
            request_payload={
                'provider': 'click',
                'booking_id': str(booking.id),
                'shop_transaction_id': merchant_transaction_id,
                'amount': float(booking.total_price),
                'return_url': return_url,
                'callback_url': callback_url,
                'checkout_url': self.click_checkout_url,
                'params': params,
            },
            response_payload={'payment_url': payment_url, 'provider_payment_id': merchant_transaction_id},
        )

    def _build_payme_link(self, *, booking: Booking, merchant_transaction_id: str, base_url: str) -> PreparedPayment:
        if not self.payme_merchant_id:
            raise ValueError('Payme merchant credentials are not configured')
        return_url = self.payme_return_url or f'{base_url}/bookings'
        callback_url = self.payme_callback_url or f'{base_url}/api/v1/payments/callback/payme'
        amount_tiyin = int(round(float(booking.total_price) * 100))
        account_key = self.payme_account_key.strip() or 'booking_id'
        payme_payload: dict[str, str | int] = {
            'm': self.payme_merchant_id,
            'a': amount_tiyin,
            'l': 'uz',
            'c': return_url,
            f'ac.{account_key}': str(booking.id),
            'ac.provider_payment_id': merchant_transaction_id,
        }
        encoded = base64.b64encode(
            json.dumps(payme_payload, separators=(',', ':'), ensure_ascii=False).encode('utf-8')
        ).decode('utf-8')
        payment_url = f'{self.payme_checkout_url.rstrip("/")}/{encoded}'
        return PreparedPayment(
            provider_payment_id=merchant_transaction_id,
            payment_url=payment_url,
            request_payload={
                'provider': 'payme',
                'booking_id': str(booking.id),
                'shop_transaction_id': merchant_transaction_id,
                'amount_tiyin': amount_tiyin,
                'return_url': return_url,
                'callback_url': callback_url,
                'checkout_url': self.payme_checkout_url,
                'params': payme_payload,
            },
            response_payload={'payment_url': payment_url, 'provider_payment_id': merchant_transaction_id},
        )

    def _build_rahmat_link(self, *, booking: Booking, merchant_transaction_id: str, base_url: str) -> PreparedPayment:
        if not self.rahmat_merchant_id:
            raise ValueError('Rahmat merchant credentials are not configured')
        return_url = self.rahmat_return_url or f'{base_url}/bookings'
        callback_url = self.rahmat_callback_url or f'{base_url}/api/v1/payments/callback/rahmat'
        params = {
            'merchant_id': self.rahmat_merchant_id,
            'order_id': merchant_transaction_id,
            'account_id': str(booking.id),
            'amount': f'{float(booking.total_price):.2f}',
            'currency': 'UZS',
            'return_url': return_url,
            'callback_url': callback_url,
        }
        payment_url = f'{self.rahmat_checkout_url.rstrip("/")}?{urlencode(params)}'
        return PreparedPayment(
            provider_payment_id=merchant_transaction_id,
            payment_url=payment_url,
            request_payload={
                'provider': 'rahmat',
                'booking_id': str(booking.id),
                'shop_transaction_id': merchant_transaction_id,
                'amount': float(booking.total_price),
                'return_url': return_url,
                'callback_url': callback_url,
                'checkout_url': self.rahmat_checkout_url,
                'params': params,
            },
            response_payload={'payment_url': payment_url, 'provider_payment_id': merchant_transaction_id},
        )

    async def _prepare_octo_payment(
        self,
        *,
        booking: Booking,
        merchant_transaction_id: str,
        base_url: str,
    ) -> PreparedPayment:
        self._require_octo_credentials()
        return_url = self.octo_return_url or f'{base_url}/bookings'
        notify_url = self.octo_notify_url or f'{base_url}/api/v1/payments/callback/octo'
        request_payload = {
            'octo_shop_id': self.octo_shop_id,
            'octo_secret': self.octo_secret,
            'shop_transaction_id': merchant_transaction_id,
            'auto_capture': self.octo_auto_capture,
            'test': self.octo_test_mode,
            'init_time': datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S'),
            'user_data': {
                'user_id': str(booking.user_id),
            },
            'total_sum': float(booking.total_price),
            'currency': 'UZS',
            'description': f'Premium House booking {booking.booking_code}',
            'payment_methods': [{'method': method} for method in self.octo_payment_methods],
            'return_url': return_url,
            'notify_url': notify_url,
            'language': self.octo_language,
            'ttl': self.octo_ttl_minutes,
        }

        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(self.octo_prepare_url, json=request_payload)
            response.raise_for_status()
            response_payload = response.json()

        if int(response_payload.get('error', -1)) != 0:
            raise ValueError(response_payload.get('errMessage') or response_payload.get('errorMessage') or 'Octo error')

        data = response_payload.get('data') or {}
        octo_payment_uuid = str(data.get('octo_payment_UUID') or '').strip()
        octo_pay_url = str(data.get('octo_pay_url') or '').strip()
        if not octo_payment_uuid or not octo_pay_url:
            raise ValueError('Octo did not return a valid payment URL')

        return PreparedPayment(
            provider_payment_id=octo_payment_uuid,
            payment_url=octo_pay_url,
            request_payload=request_payload,
            response_payload=response_payload,
        )

    async def _find_octo_payment_for_callback(self, db: AsyncSession, payload: dict) -> Payment | None:
        octo_payment_uuid = str(payload.get('octo_payment_UUID') or '').strip()
        payment_result = await db.execute(
            select(Payment)
            .where(
                Payment.provider == PaymentProvider.OCTO,
                Payment.provider_payment_id == octo_payment_uuid,
                Payment.deleted_at.is_(None),
            )
            .with_for_update()
        )
        payment = payment_result.scalar_one_or_none()
        if payment is not None:
            return payment

        shop_transaction_id = str(payload.get('shop_transaction_id') or '').strip()
        if not shop_transaction_id:
            return None

        fallback_result = await db.execute(
            select(Payment)
            .where(
                Payment.provider == PaymentProvider.OCTO,
                Payment.raw_request['shop_transaction_id'].astext == shop_transaction_id,
                Payment.deleted_at.is_(None),
            )
            .with_for_update()
        )
        return fallback_result.scalar_one_or_none()

    async def _apply_callback_transition(
        self,
        *,
        db: AsyncSession,
        provider: PaymentProvider,
        payment: Payment | None,
        callback: PaymentCallback,
        callback_status: str,
    ) -> tuple[str, uuid.UUID | None]:
        callback.processed_at = datetime.now(timezone.utc)

        if payment is None:
            await db.commit()
            return 'payment_not_found', None

        booking_result = await db.execute(
            select(Booking).where(Booking.id == payment.booking_id, Booking.deleted_at.is_(None)).with_for_update()
        )
        booking = booking_result.scalar_one_or_none()
        if booking is None:
            await db.commit()
            return 'booking_not_found', None

        if callback_status == 'pending':
            await db.commit()
            return 'ignored_non_terminal', booking.id

        if callback_status == 'success':
            if payment.status == PaymentStatus.SUCCESS:
                await db.commit()
                return 'already_confirmed', booking.id
            if booking.status != BookingStatus.PENDING_PAYMENT:
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
            await db.commit()
            enqueue_booking_sheet_export(booking.id, 'booking_confirmed_payment_success')
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

        await db.commit()
        if booking.status == BookingStatus.CANCELLED:
            enqueue_booking_sheet_export(booking.id, 'booking_cancelled_payment_failed')
        return 'processed_failed', booking.id

    async def _callback_booking_id(self, db: AsyncSession, payment_id: uuid.UUID | None) -> uuid.UUID | None:
        if payment_id is None:
            return None
        payment_for_cb = await db.execute(
            select(Payment).where(Payment.id == payment_id, Payment.deleted_at.is_(None))
        )
        payment_obj = payment_for_cb.scalar_one_or_none()
        return payment_obj.booking_id if payment_obj else None

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

    async def _record_refund_financials(
        self,
        *,
        db: AsyncSession,
        booking: Booking,
        payment: Payment,
        refund: Refund,
        refund_amount: float,
        original_payment_amount: float,
    ) -> None:
        property_result = await db.execute(
            select(Property).where(Property.id == booking.property_id, Property.deleted_at.is_(None))
        )
        property_obj = property_result.scalar_one()

        refund_ratio = min(refund_amount / original_payment_amount, 1.0)
        platform_refund = round(float(booking.platform_commission_snapshot) * refund_ratio, 2)
        host_refund = round(refund_amount - platform_refund, 2)

        refund_txn = Transaction(
            booking_id=booking.id,
            payment_id=payment.id,
            txn_type=TransactionType.REFUND_OUT,
            amount=refund_amount,
            currency=payment.currency,
            provider_reference=refund.provider_refund_id or payment.provider_payment_id,
            txn_metadata={
                'provider': payment.provider.value,
                'reason': refund.reason,
                'platform_refund': platform_refund,
                'host_refund': host_refund,
            },
        )
        db.add(refund_txn)
        await db.flush()

        platform_balance_result = await db.execute(
            select(PlatformBalance).where(PlatformBalance.currency == payment.currency, PlatformBalance.deleted_at.is_(None))
        )
        platform_balance = platform_balance_result.scalar_one_or_none()
        if platform_balance is None:
            platform_balance = PlatformBalance(currency=payment.currency, available_amount=0, pending_amount=0)
            db.add(platform_balance)
            await db.flush()

        host_balance_result = await db.execute(
            select(HostBalance).where(
                HostBalance.host_id == property_obj.host_id,
                HostBalance.currency == payment.currency,
                HostBalance.deleted_at.is_(None),
            )
        )
        host_balance = host_balance_result.scalar_one_or_none()
        if host_balance is None:
            host_balance = HostBalance(
                host_id=property_obj.host_id,
                currency=payment.currency,
                available_amount=0,
                pending_amount=0,
                total_earned_amount=0,
                total_paid_out_amount=0,
            )
            db.add(host_balance)
            await db.flush()

        platform_balance.available_amount = float(platform_balance.available_amount) - platform_refund
        host_balance.pending_amount = float(host_balance.pending_amount) - host_refund
        host_balance.total_earned_amount = float(host_balance.total_earned_amount) - host_refund

        db.add_all(
            [
                BalanceLedgerEntry(
                    account_type=AccountType.PLATFORM,
                    account_id=platform_balance.id,
                    booking_id=booking.id,
                    payment_id=payment.id,
                    transaction_id=refund_txn.id,
                    direction=LedgerDirection.DEBIT,
                    amount=platform_refund,
                    currency=payment.currency,
                    description='Platform commission reversed by refund',
                    reference_type='refund',
                    reference_id=str(refund.id),
                ),
                BalanceLedgerEntry(
                    account_type=AccountType.HOST,
                    account_id=host_balance.id,
                    booking_id=booking.id,
                    payment_id=payment.id,
                    transaction_id=refund_txn.id,
                    direction=LedgerDirection.DEBIT,
                    amount=host_refund,
                    currency=payment.currency,
                    description='Host earning reversed by refund',
                    reference_type='refund',
                    reference_id=str(refund.id),
                ),
            ]
        )

        refunded_total_result = await db.execute(
            select(func.coalesce(func.sum(Refund.amount), 0))
            .where(
                Refund.payment_id == payment.id,
                Refund.deleted_at.is_(None),
                Refund.status.in_([RefundStatus.SUCCESS, RefundStatus.PARTIAL]),
            )
        )
        refunded_total = round(float(refunded_total_result.scalar_one() or 0), 2)
        full_refund = refunded_total >= round(original_payment_amount, 2)

        payment.status = PaymentStatus.REFUNDED if full_refund else PaymentStatus.PARTIAL_REFUNDED

        if full_refund and booking.status == BookingStatus.CONFIRMED:
            old_status = booking.status
            booking.status = BookingStatus.CANCELLED
            booking.cancel_reason = refund.reason or 'payment_refunded'
            booking.cancelled_at = datetime.now(timezone.utc)
            db.add(
                BookingEvent(
                    booking_id=booking.id,
                    old_status=old_status,
                    new_status=BookingStatus.CANCELLED,
                    event_type='booking_cancelled_refunded',
                    event_payload={'payment_id': str(payment.id), 'refund_id': str(refund.id)},
                )
            )
            return

        db.add(
            BookingEvent(
                booking_id=booking.id,
                old_status=booking.status,
                new_status=booking.status,
                event_type='payment_refunded',
                event_payload={'payment_id': str(payment.id), 'refund_id': str(refund.id)},
            )
        )

    def _normalize_generic_callback_status(self, callback_status: str) -> str:
        normalized = callback_status.strip().lower()
        if normalized == 'success':
            return 'success'
        return 'failed'

    def _normalize_octo_callback_status(self, callback_status: str) -> str:
        normalized = callback_status.strip().lower()
        if normalized == 'succeeded':
            return 'success'
        if normalized in {'canceled', 'cancelled', 'failed', 'expired'}:
            return 'failed'
        return 'pending'

    def _normalize_local_refund_status(self, *, provider_status: str, refund_amount: float, remaining_amount: float) -> RefundStatus:
        normalized = provider_status.strip().lower()
        if normalized == 'succeeded':
            if refund_amount < remaining_amount:
                return RefundStatus.PARTIAL
            return RefundStatus.SUCCESS
        if normalized == 'failed':
            return RefundStatus.FAILED
        return RefundStatus.PENDING

    def _build_octo_refund_id(self, idempotency_key: str) -> str:
        digest = hashlib.sha1(idempotency_key.encode('utf-8')).hexdigest()
        return f'ph_refund_{digest[:24]}'

    def _parse_octo_datetime(self, value: str) -> datetime | None:
        if not value:
            return None
        try:
            return datetime.strptime(value, '%Y-%m-%d %H:%M:%S').replace(tzinfo=timezone.utc)
        except ValueError:
            return None

    def _require_octo_credentials(self) -> None:
        if not self.octo_shop_id or not self.octo_secret:
            raise ValueError('Octo merchant credentials are not configured')
