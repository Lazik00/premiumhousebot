import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.media import normalize_media_url
from app.db.session import get_db
from app.schemas.property import (
    AmenityResponse,
    BlockedRangeResponse,
    HostBriefResponse,
    PropertyAvailabilityResponse,
    PropertyDetailResponse,
    PropertyImageResponse,
    PropertyListResponse,
    PropertySummaryResponse,
)
from app.services.property_service import PropertyService

router = APIRouter(prefix='/properties', tags=['properties'])
property_service = PropertyService()


def _to_summary(payload: tuple, cover_image: str | None = None) -> PropertySummaryResponse:
    property_obj, city_obj, region_obj = payload
    return PropertySummaryResponse(
        id=str(property_obj.id),
        title=property_obj.title,
        description=property_obj.description,
        address=property_obj.address,
        region=region_obj.name_uz,
        city=city_obj.name_uz,
        latitude=float(property_obj.latitude),
        longitude=float(property_obj.longitude),
        property_type=property_obj.property_type.value,
        capacity=int(property_obj.capacity),
        rooms=int(property_obj.rooms),
        bathrooms=int(property_obj.bathrooms),
        price_per_night=float(property_obj.price_per_night),
        currency=property_obj.currency,
        cleaning_fee=float(property_obj.cleaning_fee),
        service_fee=float(property_obj.service_fee),
        average_rating=float(property_obj.average_rating),
        review_count=int(property_obj.review_count),
        cover_image=cover_image,
    )


@router.get('', response_model=PropertyListResponse)
async def list_properties(
    city: str | None = Query(default=None, min_length=1, max_length=120),
    min_price: float | None = Query(default=None, ge=0),
    max_price: float | None = Query(default=None, ge=0),
    guests: int | None = Query(default=None, ge=1, le=30),
    check_in: date | None = Query(default=None),
    check_out: date | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=50),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
) -> PropertyListResponse:
    if (check_in and not check_out) or (check_out and not check_in):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='check_in and check_out must be provided together',
        )
    if check_in and check_out and check_out <= check_in:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='check_out must be after check_in')

    rows, total = await property_service.list_properties(
        db=db,
        city=city,
        min_price=min_price,
        max_price=max_price,
        guests=guests,
        check_in=check_in,
        check_out=check_out,
        limit=limit,
        offset=offset,
    )

    items = []
    for row in rows:
        prop = row[0]
        cover = await property_service.get_cover_image(db=db, property_id=prop.id)
        items.append(_to_summary(row, cover_image=cover))

    return PropertyListResponse(
        items=items,
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get('/{property_id}', response_model=PropertyDetailResponse)
async def get_property(property_id: str, db: AsyncSession = Depends(get_db)) -> PropertyDetailResponse:
    try:
        property_uuid = uuid.UUID(property_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Invalid property id') from exc

    row = await property_service.get_property_detail(db=db, property_id=property_uuid)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Property not found')

    property_obj = row[0]
    cover = await property_service.get_cover_image(db=db, property_id=property_uuid)
    summary = _to_summary(row, cover_image=cover)

    images = await property_service.get_property_images(db=db, property_id=property_uuid)
    amenities = await property_service.get_property_amenities(db=db, property_id=property_uuid)
    host = await property_service.get_host(db=db, host_id=property_obj.host_id)

    return PropertyDetailResponse(
        **summary.model_dump(),
        total_area_sqm=float(property_obj.total_area_sqm) if property_obj.total_area_sqm is not None else None,
        floor=int(property_obj.floor) if property_obj.floor is not None else None,
        total_floors=int(property_obj.total_floors) if property_obj.total_floors is not None else None,
        bedrooms=int(property_obj.bedrooms) if property_obj.bedrooms is not None else None,
        beds=int(property_obj.beds) if property_obj.beds is not None else None,
        cancellation_policy=property_obj.cancellation_policy,
        house_rules=property_obj.house_rules,
        images=[
            PropertyImageResponse(
                id=str(img.id),
                image_url=normalize_media_url(
                    img.image_url,
                    object_key=img.object_key,
                    configured_base_url=settings.payment_public_base_url,
                ),
                is_cover=img.is_cover,
                sort_order=img.sort_order,
            )
            for img in images
        ],
        amenities=[
            AmenityResponse(
                id=str(a.id),
                code=a.code,
                name_uz=a.name_uz,
                name_ru=a.name_ru,
                name_en=a.name_en,
                icon=a.icon,
            )
            for a in amenities
        ],
        host=HostBriefResponse(
            id=str(host.id),
            first_name=host.first_name,
            last_name=host.last_name,
            photo_url=host.photo_url,
        ) if host else None,
    )


@router.get('/{property_id}/availability', response_model=PropertyAvailabilityResponse)
async def get_property_availability(
    property_id: str,
    from_date: date | None = Query(default=None),
    to_date: date | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
) -> PropertyAvailabilityResponse:
    try:
        property_uuid = uuid.UUID(property_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Invalid property id') from exc

    if from_date and to_date and to_date <= from_date:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='to_date must be after from_date')

    property_row = await property_service.get_property_detail(db=db, property_id=property_uuid)
    if property_row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Property not found')

    bookings = await property_service.get_blocked_ranges(
        db=db,
        property_id=property_uuid,
        from_date=from_date,
        to_date=to_date,
    )
    return PropertyAvailabilityResponse(
        property_id=str(property_uuid),
        blocked_ranges=[
            BlockedRangeResponse(
                id=str(item.id) if item.id else None,
                start_date=item.start_date,
                end_date=item.end_date,
                status=item.status,
                source=item.source,
                label=item.label,
                note=item.note,
                booking_id=str(item.booking_id) if item.booking_id else None,
                created_at=item.created_at,
            )
            for item in bookings
        ],
    )
