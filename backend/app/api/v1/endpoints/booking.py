import uuid

from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.core.rate_limit import limiter
from app.db.session import get_db
from app.models.user import User
from app.schemas.booking import BookingCancelRequest, BookingCreateRequest, BookingListResponse, BookingResponse
from app.services.booking_service import BookingService

router = APIRouter(prefix='/bookings', tags=['bookings'])
booking_service = BookingService()


@router.post('', response_model=BookingResponse)
@limiter.limit('20/minute')
async def create_booking(
    request: Request,
    response: Response,
    payload: BookingCreateRequest,
    idempotency_key: str = Header(..., alias='Idempotency-Key'),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BookingResponse:
    try:
        booking = await booking_service.create_booking(
            db=db,
            user_id=current_user.id,
            property_id=uuid.UUID(payload.property_id),
            start_date=payload.start_date,
            end_date=payload.end_date,
            idempotency_key=idempotency_key,
            guests_total=payload.guests_total,
            guests_adults_men=payload.guests_adults_men,
            guests_adults_women=payload.guests_adults_women,
            guests_children=payload.guests_children,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc

    return BookingResponse(
        id=str(booking.id),
        booking_code=booking.booking_code,
        user_id=str(booking.user_id),
        property_id=str(booking.property_id),
        start_date=booking.start_date,
        end_date=booking.end_date,
        total_nights=booking.total_nights,
        guests_total=booking.guests_total,
        guests_adults_men=booking.guests_adults_men,
        guests_adults_women=booking.guests_adults_women,
        guests_children=booking.guests_children,
        price_per_night_snapshot=float(booking.price_per_night_snapshot),
        total_price=float(booking.total_price),
        status=booking.status.value,
        expires_at=booking.expires_at,
        confirmed_at=booking.confirmed_at,
        cancelled_at=booking.cancelled_at,
        created_at=booking.created_at,
    )


@router.get('/my', response_model=BookingListResponse)
async def list_my_bookings(
    limit: int = 20,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BookingListResponse:
    rows, total = await booking_service.list_user_bookings(
        db=db,
        user_id=current_user.id,
        limit=limit,
        offset=offset,
    )
    items = [
        BookingResponse(
            id=str(booking.id),
            booking_code=booking.booking_code,
            user_id=str(booking.user_id),
            property_id=str(booking.property_id),
            start_date=booking.start_date,
            end_date=booking.end_date,
            total_nights=booking.total_nights,
            guests_total=booking.guests_total,
            guests_adults_men=booking.guests_adults_men,
            guests_adults_women=booking.guests_adults_women,
            guests_children=booking.guests_children,
            price_per_night_snapshot=float(booking.price_per_night_snapshot),
            total_price=float(booking.total_price),
            status=booking.status.value,
            expires_at=booking.expires_at,
            confirmed_at=booking.confirmed_at,
            cancelled_at=booking.cancelled_at,
            created_at=booking.created_at,
        )
        for booking in rows
    ]
    return BookingListResponse(items=items, total=total, limit=limit, offset=offset)


@router.get('/{booking_id}', response_model=BookingResponse)
async def get_booking(
    booking_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BookingResponse:
    booking = await booking_service.get_booking(db=db, booking_id=uuid.UUID(booking_id))
    if booking is None or booking.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Booking not found')

    return BookingResponse(
        id=str(booking.id),
        booking_code=booking.booking_code,
        user_id=str(booking.user_id),
        property_id=str(booking.property_id),
        start_date=booking.start_date,
        end_date=booking.end_date,
        total_nights=booking.total_nights,
        guests_total=booking.guests_total,
        guests_adults_men=booking.guests_adults_men,
        guests_adults_women=booking.guests_adults_women,
        guests_children=booking.guests_children,
        price_per_night_snapshot=float(booking.price_per_night_snapshot),
        total_price=float(booking.total_price),
        status=booking.status.value,
        expires_at=booking.expires_at,
        confirmed_at=booking.confirmed_at,
        cancelled_at=booking.cancelled_at,
        created_at=booking.created_at,
    )


@router.post('/{booking_id}/cancel', response_model=BookingResponse)
async def cancel_booking(
    booking_id: str,
    payload: BookingCancelRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BookingResponse:
    booking = await booking_service.get_booking(db=db, booking_id=uuid.UUID(booking_id))
    if booking is None or booking.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Booking not found')

    try:
        booking = await booking_service.cancel_booking(db=db, booking=booking, reason=payload.reason)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return BookingResponse(
        id=str(booking.id),
        booking_code=booking.booking_code,
        user_id=str(booking.user_id),
        property_id=str(booking.property_id),
        start_date=booking.start_date,
        end_date=booking.end_date,
        total_nights=booking.total_nights,
        guests_total=booking.guests_total,
        guests_adults_men=booking.guests_adults_men,
        guests_adults_women=booking.guests_adults_women,
        guests_children=booking.guests_children,
        price_per_night_snapshot=float(booking.price_per_night_snapshot),
        total_price=float(booking.total_price),
        status=booking.status.value,
        expires_at=booking.expires_at,
        confirmed_at=booking.confirmed_at,
        cancelled_at=booking.cancelled_at,
        created_at=booking.created_at,
    )
