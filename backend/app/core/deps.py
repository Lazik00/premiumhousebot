import uuid

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import TokenError, extract_subject
from app.db.session import get_db
from app.models.enums import UserStatus
from app.models.user import Role, User, UserRole

oauth2_scheme = OAuth2PasswordBearer(tokenUrl='/api/v1/auth/telegram')


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    try:
        user_id = extract_subject(token, expected_type='access')
        user_uuid = uuid.UUID(user_id)
    except (TokenError, ValueError, TypeError) as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid access token') from exc

    result = await db.execute(
        select(User).where(
            User.id == user_uuid,
            User.deleted_at.is_(None),
            User.status == UserStatus.ACTIVE,
        )
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='User not found or inactive')
    return user


async def get_current_user_role_codes(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> set[str]:
    result = await db.execute(
        select(Role.code)
        .join(UserRole, UserRole.role_id == Role.id)
        .where(
            UserRole.user_id == current_user.id,
            Role.deleted_at.is_(None),
            UserRole.deleted_at.is_(None),
        )
    )
    return set(result.scalars().all())


def require_roles(*allowed_roles: str):
    allowed = set(allowed_roles)

    async def _dependency(
        current_user: User = Depends(get_current_user),
        role_codes: set[str] = Depends(get_current_user_role_codes),
    ) -> User:
        if role_codes.isdisjoint(allowed):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Insufficient permissions')
        return current_user

    return _dependency
