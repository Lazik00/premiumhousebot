import hashlib
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.deps import get_current_user, require_roles
from app.core.rate_limit import limiter
from app.db.session import get_db
from app.models.enums import PaymentProvider
from app.models.user import User
from app.schemas.payment import (
    PaymentCallbackRequest,
    PaymentCallbackResponse,
    PaymentCreateRequest,
    PaymentCreateResponse,
    OctoCallbackRequest,
    PaymentRefundRequest,
    PaymentRefundResponse,
)
from app.services.payment_service import PaymentService

router = APIRouter(prefix='/payments', tags=['payments'])


def _payment_service() -> PaymentService:
    return PaymentService(
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


@router.post('/create-link', response_model=PaymentCreateResponse)
@limiter.limit('30/minute')
async def create_payment_link(
    request: Request,
    payload: PaymentCreateRequest,
    idempotency_key: str | None = Header(default=None, alias='Idempotency-Key'),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PaymentCreateResponse:
    service = _payment_service()
    resolved_idempotency_key = _resolve_idempotency_key(
        idempotency_key=idempotency_key,
        user_id=current_user.id,
        booking_id=payload.booking_id,
        provider=payload.provider,
    )
    try:
        payment = await service.create_payment_link(
            db=db,
            user_id=current_user.id,
            booking_id=uuid.UUID(payload.booking_id),
            provider=PaymentProvider(payload.provider),
            idempotency_key=resolved_idempotency_key,
            request_base_url=_request_base_url(request),
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return PaymentCreateResponse(
        payment_id=str(payment.id),
        booking_id=str(payment.booking_id),
        provider=payment.provider.value,
        status=payment.status.value,
        payment_url=payment.payment_url or '',
        amount=float(payment.amount),
        currency=payment.currency,
    )


@router.post('/callback/octo', response_model=PaymentCallbackResponse)
async def octo_payment_callback(
    payload: OctoCallbackRequest,
    db: AsyncSession = Depends(get_db),
) -> PaymentCallbackResponse:
    service = _payment_service()
    try:
        status_value, booking_id = await service.process_octo_callback(
            db=db,
            payload=payload.model_dump(by_alias=True, exclude_none=True),
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    if status_value == 'invalid_signature':
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid signature')

    return PaymentCallbackResponse(
        status=status_value,
        booking_id=str(booking_id) if booking_id else None,
        processed_at=datetime.now(timezone.utc),
    )


@router.post('/callback/{provider}', response_model=PaymentCallbackResponse)
async def payment_callback(
    provider: PaymentProvider,
    payload: PaymentCallbackRequest,
    db: AsyncSession = Depends(get_db),
    x_signature: str = Header(..., alias='X-Signature'),
) -> PaymentCallbackResponse:
    if provider == PaymentProvider.OCTO:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Use /payments/callback/octo')

    service = _payment_service()
    status_value, booking_id = await service.process_callback(
        db=db,
        provider=provider,
        provider_event_id=payload.provider_event_id,
        payment_id=uuid.UUID(payload.payment_id),
        callback_status=payload.status,
        payload=payload.payload,
        signature=x_signature,
    )

    if status_value == 'invalid_signature':
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid signature')

    return PaymentCallbackResponse(
        status=status_value,
        booking_id=str(booking_id) if booking_id else None,
        processed_at=datetime.now(timezone.utc),
    )


@router.post('/{payment_id}/refund', response_model=PaymentRefundResponse)
@limiter.limit('10/minute')
async def refund_payment(
    request: Request,
    payment_id: str,
    payload: PaymentRefundRequest,
    idempotency_key: str = Header(..., alias='Idempotency-Key'),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles('super_admin', 'admin')),
) -> PaymentRefundResponse:
    service = _payment_service()
    try:
        refund = await service.refund_payment(
            db=db,
            payment_id=uuid.UUID(payment_id),
            requested_by=current_user.id,
            amount=payload.amount,
            reason=payload.reason,
            idempotency_key=idempotency_key.strip()[:120],
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return PaymentRefundResponse(
        refund_id=str(refund.id),
        payment_id=str(refund.payment_id),
        booking_id=str(refund.booking_id),
        provider=refund.provider.value,
        status=refund.status.value,
        amount=float(refund.amount),
        provider_refund_id=refund.provider_refund_id,
        processed_at=refund.processed_at,
    )


def _request_base_url(request: Request) -> str:
    forwarded_proto = request.headers.get('x-forwarded-proto')
    scheme = (forwarded_proto or request.url.scheme).split(',')[0].strip()
    host = (
        request.headers.get('x-forwarded-host')
        or request.headers.get('host')
        or request.url.netloc
    )
    return f'{scheme}://{host}'


def _resolve_idempotency_key(idempotency_key: str | None, user_id: uuid.UUID, booking_id: str, provider: str) -> str:
    if idempotency_key and idempotency_key.strip():
        return idempotency_key.strip()[:120]
    # Deterministic fallback prevents accidental duplicate payment rows on repeated taps.
    raw = f'{user_id}:{booking_id}:{provider}'
    return hashlib.sha256(raw.encode('utf-8')).hexdigest()
