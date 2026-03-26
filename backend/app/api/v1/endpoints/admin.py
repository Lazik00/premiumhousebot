import uuid

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.deps import require_roles
from app.db.session import get_db
from app.models.enums import PropertyStatus, UserStatus
from app.models.user import User
from app.schemas.admin import (
    AdminBookingDetailResponse,
    AdminBookingListResponse,
    AdminDashboardResponse,
    AdminHostBalanceListResponse,
    AdminHostBalanceDetailResponse,
    AdminMetaOptionsResponse,
    AdminPaymentDetailResponse,
    AdminPaymentListResponse,
    AdminPropertyCreateRequest,
    AdminPropertyDetailResponse,
    AdminUploadedImageResponse,
    AdminPropertyListResponse,
    AdminPropertyStatusUpdateRequest,
    AdminPropertyUpdateRequest,
    AdminUserListResponse,
    AdminUserStatusUpdateRequest,
)
from app.services.admin_service import AdminService
from app.services.storage_service import StorageService

router = APIRouter(prefix='/admin', tags=['admin'])
admin_service = AdminService()
admin_guard = require_roles('super_admin', 'admin')


def _to_uuid(value: str, label: str) -> uuid.UUID:
    try:
        return uuid.UUID(value)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f'Invalid {label}') from exc


def _raise_service_error(exc: ValueError) -> None:
    message = str(exc)
    status_code = status.HTTP_404_NOT_FOUND if 'not found' in message.lower() else status.HTTP_400_BAD_REQUEST
    raise HTTPException(status_code=status_code, detail=message) from exc


def _request_base_url(request: Request) -> str:
    forwarded_proto = request.headers.get('x-forwarded-proto')
    scheme = (forwarded_proto or request.url.scheme).split(',')[0].strip()
    host = (
        request.headers.get('x-forwarded-host')
        or request.headers.get('host')
        or request.url.netloc
    )
    forwarded_port = (request.headers.get('x-forwarded-port') or '').split(',')[0].strip()
    if forwarded_port and ':' not in host:
        is_default_port = (scheme == 'http' and forwarded_port == '80') or (scheme == 'https' and forwarded_port == '443')
        if not is_default_port:
            host = f'{host}:{forwarded_port}'
    return f'{scheme}://{host}'


@router.get('/dashboard', response_model=AdminDashboardResponse)
async def get_dashboard(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(admin_guard),
) -> AdminDashboardResponse:
    del current_user
    return await admin_service.get_dashboard(db)


@router.get('/meta/options', response_model=AdminMetaOptionsResponse)
async def get_meta_options(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(admin_guard),
) -> AdminMetaOptionsResponse:
    del current_user
    return await admin_service.get_meta_options(db)


@router.post('/property-images/upload', response_model=AdminUploadedImageResponse, status_code=status.HTTP_201_CREATED)
async def upload_property_image(
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Depends(admin_guard),
) -> AdminUploadedImageResponse:
    del current_user
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Filename is required')
    content_type = (file.content_type or '').lower()
    if not content_type.startswith('image/'):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Only image files are allowed')
    data = await file.read()
    if not data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Uploaded file is empty')
    if len(data) > 10 * 1024 * 1024:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Image must be 10MB or smaller')

    storage = StorageService(
        endpoint=str(settings.s3_endpoint) if settings.s3_endpoint else None,
        bucket=settings.s3_bucket,
        access_key=settings.s3_access_key,
        secret_key=settings.s3_secret_key,
    )
    try:
        stored = await storage.upload_property_image(
            filename=file.filename,
            content_type=file.content_type,
            data=data,
            request_base_url=_request_base_url(request),
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc

    return AdminUploadedImageResponse(
        object_key=stored.object_key,
        image_url=stored.image_url,
        original_name=stored.original_name,
        content_type=stored.content_type,
        size=stored.size,
    )


@router.get('/users', response_model=AdminUserListResponse)
async def list_users(
    search: str | None = Query(default=None, min_length=1, max_length=120),
    status_value: str | None = Query(default=None, alias='status', pattern='^(active|blocked|pending)$'),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(admin_guard),
) -> AdminUserListResponse:
    del current_user
    return await admin_service.list_users(db=db, limit=limit, offset=offset, search=search, status=status_value)


@router.put('/users/{user_id}/status', response_model=dict[str, str])
async def update_user_status(
    user_id: str,
    payload: AdminUserStatusUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(admin_guard),
) -> dict[str, str]:
    try:
        updated_user = await admin_service.update_user_status(
            db=db,
            user_id=uuid.UUID(user_id),
            status=UserStatus(payload.status),
            acting_user_id=current_user.id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return {'id': str(updated_user.id), 'status': updated_user.status.value}


@router.get('/properties', response_model=AdminPropertyListResponse)
async def list_properties(
    search: str | None = Query(default=None, min_length=1, max_length=120),
    status_value: str | None = Query(default=None, alias='status', pattern='^(draft|pending_review|active|blocked|archived)$'),
    property_type: str | None = Query(default=None, pattern='^(apartment|house|villa)$'),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(admin_guard),
) -> AdminPropertyListResponse:
    del current_user
    return await admin_service.list_properties(
        db=db,
        limit=limit,
        offset=offset,
        search=search,
        status=status_value,
        property_type=property_type,
    )


@router.get('/properties/{property_id}', response_model=AdminPropertyDetailResponse)
async def get_property_detail(
    property_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(admin_guard),
) -> AdminPropertyDetailResponse:
    del current_user
    try:
        return await admin_service.get_property_detail(db, _to_uuid(property_id, 'property_id'))
    except ValueError as exc:
        _raise_service_error(exc)


@router.post('/properties', response_model=AdminPropertyDetailResponse, status_code=status.HTTP_201_CREATED)
async def create_property(
    payload: AdminPropertyCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(admin_guard),
) -> AdminPropertyDetailResponse:
    del current_user
    try:
        return await admin_service.create_property(db, payload)
    except ValueError as exc:
        _raise_service_error(exc)


@router.put('/properties/{property_id}', response_model=AdminPropertyDetailResponse)
async def update_property(
    property_id: str,
    payload: AdminPropertyUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(admin_guard),
) -> AdminPropertyDetailResponse:
    del current_user
    try:
        return await admin_service.update_property(db, _to_uuid(property_id, 'property_id'), payload)
    except ValueError as exc:
        _raise_service_error(exc)


@router.put('/properties/{property_id}/status', response_model=dict[str, str])
async def update_property_status(
    property_id: str,
    payload: AdminPropertyStatusUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(admin_guard),
) -> dict[str, str]:
    del current_user
    try:
        property_obj = await admin_service.update_property_status(
            db=db,
            property_id=uuid.UUID(property_id),
            status=PropertyStatus(payload.status),
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return {'id': str(property_obj.id), 'status': property_obj.status.value}


@router.get('/bookings', response_model=AdminBookingListResponse)
async def list_bookings(
    search: str | None = Query(default=None, min_length=1, max_length=120),
    status_value: str | None = Query(default=None, alias='status', pattern='^(pending_payment|confirmed|cancelled|completed|expired)$'),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(admin_guard),
) -> AdminBookingListResponse:
    del current_user
    return await admin_service.list_bookings(db=db, limit=limit, offset=offset, search=search, status=status_value)


@router.get('/bookings/{booking_id}', response_model=AdminBookingDetailResponse)
async def get_booking_detail(
    booking_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(admin_guard),
) -> AdminBookingDetailResponse:
    del current_user
    try:
        return await admin_service.get_booking_detail(db, _to_uuid(booking_id, 'booking_id'))
    except ValueError as exc:
        _raise_service_error(exc)


@router.get('/payments', response_model=AdminPaymentListResponse)
async def list_payments(
    search: str | None = Query(default=None, min_length=1, max_length=120),
    status_value: str | None = Query(default=None, alias='status', pattern='^(initiated|pending|success|failed|cancelled|refunded|partial_refunded)$'),
    provider: str | None = Query(default=None, pattern='^(rahmat|click|payme|octo)$'),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(admin_guard),
) -> AdminPaymentListResponse:
    del current_user
    return await admin_service.list_payments(
        db=db,
        limit=limit,
        offset=offset,
        search=search,
        status=status_value,
        provider=provider,
    )


@router.get('/payments/{payment_id}', response_model=AdminPaymentDetailResponse)
async def get_payment_detail(
    payment_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(admin_guard),
) -> AdminPaymentDetailResponse:
    del current_user
    try:
        return await admin_service.get_payment_detail(db, _to_uuid(payment_id, 'payment_id'))
    except ValueError as exc:
        _raise_service_error(exc)


@router.get('/host-balances', response_model=AdminHostBalanceListResponse)
async def list_host_balances(
    search: str | None = Query(default=None, min_length=1, max_length=120),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(admin_guard),
) -> AdminHostBalanceListResponse:
    del current_user
    return await admin_service.list_host_balances(db=db, limit=limit, offset=offset, search=search)


@router.get('/host-balances/{host_id}', response_model=AdminHostBalanceDetailResponse)
async def get_host_balance_detail(
    host_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(admin_guard),
) -> AdminHostBalanceDetailResponse:
    del current_user
    try:
        return await admin_service.get_host_balance_detail(db, _to_uuid(host_id, 'host_id'))
    except ValueError as exc:
        _raise_service_error(exc)
