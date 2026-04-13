import uuid
from datetime import UTC, datetime, timedelta
from urllib.parse import quote

import httpx
from jose import jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.booking import Booking
from app.models.integration import IntegrationDeliveryLog
from app.models.property import Property
from app.models.user import User


class GoogleSheetsService:
    scope = 'https://www.googleapis.com/auth/spreadsheets'
    destination = 'google_sheets'
    headers = [
        'timestamp_utc',
        'event_type',
        'booking_id',
        'booking_code',
        'booking_status',
        'property_id',
        'property_title',
        'customer_id',
        'customer_name',
        'check_in',
        'check_out',
        'total_nights',
        'guests_total',
        'total_price',
        'currency',
        'source',
    ]

    def is_enabled(self) -> bool:
        return bool(settings.google_sheets_enabled)

    def is_configured(self) -> bool:
        return bool(
            settings.google_sheets_spreadsheet_id
            and settings.google_sheets_service_account_email
            and settings.resolved_google_sheets_private_key
        )

    async def append_booking_event(self, db: AsyncSession, *, booking_id: uuid.UUID, event_type: str) -> str:
        if not self.is_enabled():
            return 'disabled'
        if not self.is_configured():
            return 'misconfigured'

        row_result = await db.execute(
            select(Booking, Property, User)
            .join(Property, Property.id == Booking.property_id)
            .join(User, User.id == Booking.user_id)
            .where(
                Booking.id == booking_id,
                Booking.deleted_at.is_(None),
                Property.deleted_at.is_(None),
                User.deleted_at.is_(None),
            )
        )
        row = row_result.one_or_none()
        if row is None:
            return 'booking_not_found'

        booking, property_obj, user_obj = row
        event_key = f'booking:{booking.id}:{booking.status.value}:{event_type}'
        existing = await db.execute(
            select(IntegrationDeliveryLog).where(
                IntegrationDeliveryLog.destination == self.destination,
                IntegrationDeliveryLog.event_key == event_key,
            )
        )
        if existing.scalar_one_or_none() is not None:
            return 'already_delivered'

        access_token = await self._issue_access_token()
        await self._ensure_header_row(access_token)
        customer_name = ' '.join(part for part in [user_obj.first_name, user_obj.last_name] if part).strip() or (user_obj.username or '')
        values = [
            datetime.now(UTC).isoformat(),
            event_type,
            str(booking.id),
            booking.booking_code,
            booking.status.value,
            str(property_obj.id),
            property_obj.title,
            str(user_obj.id),
            customer_name,
            booking.start_date.isoformat(),
            booking.end_date.isoformat(),
            str(booking.total_nights),
            str(booking.guests_total),
            str(float(booking.total_price)),
            'UZS',
            'premiumhouse',
        ]
        await self._append_row(access_token=access_token, values=values)

        db.add(
            IntegrationDeliveryLog(
                destination=self.destination,
                event_key=event_key,
                entity_type='booking',
                entity_id=booking.id,
                payload={'event_type': event_type, 'status': booking.status.value},
            )
        )
        await db.commit()
        return 'delivered'

    async def _issue_access_token(self) -> str:
        now = datetime.now(UTC)
        claims = {
            'iss': settings.google_sheets_service_account_email,
            'scope': self.scope,
            'aud': settings.google_sheets_token_uri,
            'iat': int(now.timestamp()),
            'exp': int((now + timedelta(minutes=55)).timestamp()),
        }
        assertion = jwt.encode(
            claims,
            settings.resolved_google_sheets_private_key,
            algorithm='RS256',
        )
        payload = {
            'grant_type': 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            'assertion': assertion,
        }
        async with httpx.AsyncClient(timeout=settings.google_sheets_timeout_seconds) as client:
            response = await client.post(
                settings.google_sheets_token_uri,
                data=payload,
                headers={'Content-Type': 'application/x-www-form-urlencoded'},
            )
            response.raise_for_status()
            token_data = response.json()
        token = token_data.get('access_token')
        if not token:
            raise ValueError('Google access token not returned')
        return token

    async def _ensure_header_row(self, access_token: str) -> None:
        sheet_name = settings.google_sheets_sheet_name
        spreadsheet_id = settings.google_sheets_spreadsheet_id
        read_range = quote(f'{sheet_name}!A1:P1', safe='')
        read_url = f'https://sheets.googleapis.com/v4/spreadsheets/{spreadsheet_id}/values/{read_range}'
        async with httpx.AsyncClient(timeout=settings.google_sheets_timeout_seconds) as client:
            response = await client.get(
                read_url,
                headers={'Authorization': f'Bearer {access_token}'},
            )
            response.raise_for_status()
            payload = response.json()
            values = payload.get('values') or []
            if values:
                return

            write_url = (
                f'https://sheets.googleapis.com/v4/spreadsheets/{spreadsheet_id}/values/{read_range}'
                '?valueInputOption=RAW'
            )
            write_response = await client.put(
                write_url,
                headers={
                    'Authorization': f'Bearer {access_token}',
                    'Content-Type': 'application/json',
                },
                json={'range': f'{sheet_name}!A1:P1', 'majorDimension': 'ROWS', 'values': [self.headers]},
            )
            write_response.raise_for_status()

    async def _append_row(self, *, access_token: str, values: list[str]) -> None:
        sheet_name = settings.google_sheets_sheet_name
        spreadsheet_id = settings.google_sheets_spreadsheet_id
        range_path = quote(f'{sheet_name}!A1', safe='')
        url = (
            f'https://sheets.googleapis.com/v4/spreadsheets/{spreadsheet_id}/values/{range_path}:append'
            '?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS'
        )
        async with httpx.AsyncClient(timeout=settings.google_sheets_timeout_seconds) as client:
            response = await client.post(
                url,
                headers={
                    'Authorization': f'Bearer {access_token}',
                    'Content-Type': 'application/json',
                },
                json={
                    'range': f'{sheet_name}!A1',
                    'majorDimension': 'ROWS',
                    'values': [values],
                },
            )
            response.raise_for_status()
