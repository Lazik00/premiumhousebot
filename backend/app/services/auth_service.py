import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.config import settings
from app.core.security import TokenError, create_access_token, create_refresh_token, extract_subject, hash_token
from app.models.enums import UserStatus
from app.models.user import AuthAuditLog, RefreshToken, Role, User, UserRole
from app.schemas.auth import AuthUserResponse, TelegramAuthResponse, TokenPairResponse
from app.services.telegram_auth_service import TelegramAuthService


class AuthService:
    def __init__(self) -> None:
        self.telegram_verifier: TelegramAuthService | None = None

    async def telegram_login(
        self,
        db: AsyncSession,
        init_data: str,
        user_agent: str | None,
        ip_address: str | None,
    ) -> TelegramAuthResponse:
        identity = self._verifier().verify_init_data(init_data)

        user_result = await db.execute(select(User).where(User.telegram_id == identity.telegram_id, User.deleted_at.is_(None)))
        user = user_result.scalar_one_or_none()

        if user is None:
            user = User(
                telegram_id=identity.telegram_id,
                first_name=identity.first_name,
                last_name=identity.last_name,
                username=identity.username,
                photo_url=identity.photo_url,
                status=UserStatus.ACTIVE,
                language_code='uz',
                time_zone='Asia/Tashkent',
                last_login_at=datetime.now(timezone.utc),
            )
            db.add(user)
            await db.flush()
            await self._assign_customer_role(db, user.id)
        else:
            user.first_name = identity.first_name
            user.last_name = identity.last_name
            user.username = identity.username
            user.photo_url = identity.photo_url
            user.last_login_at = datetime.now(timezone.utc)

        token_pair = await self._issue_tokens(
            db=db,
            user_id=user.id,
            token_family=uuid.uuid4(),
            user_agent=user_agent,
            ip_address=ip_address,
        )

        db.add(
            AuthAuditLog(
                user_id=user.id,
                telegram_id=identity.telegram_id,
                event_type='telegram_login_success',
                ip_address=ip_address,
                user_agent=user_agent,
                payload={'auth_date': identity.auth_date},
            )
        )
        await db.commit()

        return TelegramAuthResponse(
            access_token=token_pair.access_token,
            refresh_token=token_pair.refresh_token,
            token_type='bearer',
            expires_in=settings.access_token_expire_minutes * 60,
            user=AuthUserResponse(
                id=str(user.id),
                telegram_id=user.telegram_id,
                first_name=user.first_name,
                last_name=user.last_name,
                username=user.username,
                photo_url=user.photo_url,
            ),
        )

    async def refresh_tokens(
        self,
        db: AsyncSession,
        refresh_token: str,
        user_agent: str | None,
        ip_address: str | None,
    ) -> TokenPairResponse:
        try:
            subject = extract_subject(refresh_token, expected_type='refresh')
        except TokenError as exc:
            raise ValueError('Invalid refresh token') from exc

        token_hash = hash_token(refresh_token)
        token_result = await db.execute(select(RefreshToken).where(RefreshToken.token_hash == token_hash, RefreshToken.deleted_at.is_(None)))
        token_row = token_result.scalar_one_or_none()

        if token_row is None or str(token_row.user_id) != subject:
            raise ValueError('Refresh token not recognized')

        if token_row.revoked_at is not None:
            await self._revoke_token_family(db, token_row.user_id, token_row.token_family)
            db.add(
                AuthAuditLog(
                    user_id=token_row.user_id,
                    telegram_id=None,
                    event_type='refresh_reuse_detected',
                    ip_address=ip_address,
                    user_agent=user_agent,
                    payload={},
                )
            )
            await db.commit()
            raise ValueError('Refresh token reuse detected')

        if token_row.expires_at <= datetime.now(timezone.utc):
            token_row.revoked_at = datetime.now(timezone.utc)
            await db.commit()
            raise ValueError('Refresh token expired')

        token_row.revoked_at = datetime.now(timezone.utc)

        token_pair = await self._issue_tokens(
            db=db,
            user_id=token_row.user_id,
            token_family=token_row.token_family,
            user_agent=user_agent,
            ip_address=ip_address,
        )
        token_row.replaced_by_token_hash = hash_token(token_pair.refresh_token)

        await db.commit()
        return token_pair

    async def logout(self, db: AsyncSession, refresh_token: str) -> None:
        token_hash = hash_token(refresh_token)
        token_result = await db.execute(
            select(RefreshToken).where(
                RefreshToken.token_hash == token_hash,
                RefreshToken.deleted_at.is_(None),
                RefreshToken.revoked_at.is_(None),
            )
        )
        token_row = token_result.scalar_one_or_none()
        if token_row is not None:
            token_row.revoked_at = datetime.now(timezone.utc)
            await db.commit()

    async def _issue_tokens(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        token_family: uuid.UUID,
        user_agent: str | None,
        ip_address: str | None,
    ) -> TokenPairResponse:
        access_token = create_access_token(subject=str(user_id))
        refresh_token = create_refresh_token(subject=str(user_id))

        db.add(
            RefreshToken(
                user_id=user_id,
                token_hash=hash_token(refresh_token),
                token_family=token_family,
                user_agent=user_agent,
                ip_address=ip_address,
                expires_at=datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days),
            )
        )

        return TokenPairResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type='bearer',
            expires_in=settings.access_token_expire_minutes * 60,
        )

    async def _assign_customer_role(self, db: AsyncSession, user_id: uuid.UUID) -> None:
        role_result = await db.execute(select(Role).where(Role.code == 'customer', Role.deleted_at.is_(None)))
        role = role_result.scalar_one_or_none()
        if role is None:
            role = Role(code='customer', name='Customer')
            db.add(role)
            await db.flush()

        stmt = insert(UserRole).values(id=uuid.uuid4(), user_id=user_id, role_id=role.id).on_conflict_do_nothing(
            index_elements=['user_id', 'role_id']
        )
        await db.execute(stmt)

    async def _revoke_token_family(self, db: AsyncSession, user_id: uuid.UUID, token_family: uuid.UUID) -> None:
        stmt = (
            update(RefreshToken)
            .where(
                RefreshToken.user_id == user_id,
                RefreshToken.token_family == token_family,
                RefreshToken.deleted_at.is_(None),
                RefreshToken.revoked_at.is_(None),
            )
            .values(revoked_at=datetime.now(timezone.utc))
        )
        await db.execute(stmt)

    def _verifier(self) -> TelegramAuthService:
        if not settings.telegram_bot_token:
            raise ValueError('TELEGRAM_BOT_TOKEN is not configured')

        if self.telegram_verifier is None:
            self.telegram_verifier = TelegramAuthService(
                bot_token=settings.telegram_bot_token,
                max_age_seconds=settings.telegram_auth_max_age_seconds,
            )
        return self.telegram_verifier
