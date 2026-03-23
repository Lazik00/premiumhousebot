from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import (
    LogoutRequest,
    RefreshTokenRequest,
    RefreshTokenResponse,
    TelegramAuthRequest,
    TelegramAuthResponse,
    UserMeResponse,
)
from app.services.auth_service import AuthService
from app.services.telegram_auth_service import TelegramAuthError

router = APIRouter(prefix='/auth', tags=['auth'])
auth_service = AuthService()


def _extract_client_ip(x_forwarded_for: str | None) -> str | None:
    if not x_forwarded_for:
        return None
    return x_forwarded_for.split(',')[0].strip()


@router.post('/telegram', response_model=TelegramAuthResponse)
async def telegram_auth(
    payload: TelegramAuthRequest,
    db: AsyncSession = Depends(get_db),
    user_agent: str | None = Header(default=None, alias='User-Agent'),
    x_forwarded_for: str | None = Header(default=None, alias='X-Forwarded-For'),
) -> TelegramAuthResponse:
    try:
        return await auth_service.telegram_login(
            db=db,
            init_data=payload.init_data,
            user_agent=user_agent,
            ip_address=_extract_client_ip(x_forwarded_for),
        )
    except (TelegramAuthError, ValueError) as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc


@router.post('/refresh', response_model=RefreshTokenResponse)
async def refresh_tokens(
    payload: RefreshTokenRequest,
    db: AsyncSession = Depends(get_db),
    user_agent: str | None = Header(default=None, alias='User-Agent'),
    x_forwarded_for: str | None = Header(default=None, alias='X-Forwarded-For'),
) -> RefreshTokenResponse:
    try:
        return await auth_service.refresh_tokens(
            db=db,
            refresh_token=payload.refresh_token,
            user_agent=user_agent,
            ip_address=_extract_client_ip(x_forwarded_for),
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc


@router.post('/logout', status_code=status.HTTP_204_NO_CONTENT)
async def logout(payload: LogoutRequest, db: AsyncSession = Depends(get_db)) -> None:
    await auth_service.logout(db=db, refresh_token=payload.refresh_token)


@router.get('/me', response_model=UserMeResponse)
async def me(current_user: User = Depends(get_current_user)) -> UserMeResponse:
    return UserMeResponse(
        id=str(current_user.id),
        telegram_id=current_user.telegram_id,
        first_name=current_user.first_name,
        last_name=current_user.last_name,
        username=current_user.username,
        photo_url=current_user.photo_url,
        status=current_user.status.value,
        created_at=current_user.created_at,
    )
