import hashlib
import secrets
import uuid
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta

import httpx
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.integration import ExternalCalendarEvent, PropertyChannelCalendar
from app.models.property import Property
from app.services.property_service import PropertyService
from app.utils.locks import redis_lock

SUPPORTED_CHANNELS = ('airbnb', 'booking')


@dataclass(slots=True)
class ParsedIcalEvent:
    uid: str
    start_date: date
    end_date: date
    summary: str | None = None
    description: str | None = None
    dtstart_raw: str | None = None
    dtend_raw: str | None = None


@dataclass(slots=True)
class ChannelSyncResult:
    channel: str
    imported_count: int
    updated_count: int
    deactivated_count: int
    status: str
    error: str | None
    synced_at: datetime | None


class CalendarSyncService:
    property_service = PropertyService()

    async def list_property_channels(
        self,
        db: AsyncSession,
        *,
        property_id: uuid.UUID,
        public_base_url: str,
    ) -> list[dict]:
        await self._ensure_property_exists(db, property_id)
        configs = await self._ensure_channel_configs(db, property_id)

        count_rows = await db.execute(
            select(ExternalCalendarEvent.channel_calendar_id, ExternalCalendarEvent.id)
            .where(
                ExternalCalendarEvent.channel_calendar_id.in_([config.id for config in configs]),
                ExternalCalendarEvent.deleted_at.is_(None),
            )
        )
        count_map: dict[uuid.UUID, int] = {}
        for channel_calendar_id, _event_id in count_rows.all():
            count_map[channel_calendar_id] = count_map.get(channel_calendar_id, 0) + 1

        return [
            {
                'channel': config.channel,
                'is_enabled': bool(config.is_enabled),
                'import_ical_url': config.import_ical_url,
                'export_ical_url': self.build_export_url(public_base_url=public_base_url, token=config.export_ical_token),
                'last_synced_at': config.last_synced_at,
                'last_sync_status': config.last_sync_status,
                'last_sync_error': config.last_sync_error,
                'active_events': count_map.get(config.id, 0),
            }
            for config in sorted(
                configs,
                key=lambda item: SUPPORTED_CHANNELS.index(item.channel)
                if item.channel in SUPPORTED_CHANNELS
                else len(SUPPORTED_CHANNELS),
            )
        ]

    async def update_property_channel(
        self,
        db: AsyncSession,
        *,
        property_id: uuid.UUID,
        channel: str,
        import_ical_url: str | None,
        is_enabled: bool,
        public_base_url: str,
    ) -> dict:
        normalized_channel = self._normalize_channel(channel)
        await self._ensure_property_exists(db, property_id)
        config = await self._get_or_create_channel_config(db, property_id=property_id, channel=normalized_channel)

        cleaned_url = (import_ical_url or '').strip() or None
        if cleaned_url and not cleaned_url.startswith(('http://', 'https://')):
            raise ValueError('import_ical_url must start with http:// or https://')

        config.import_ical_url = cleaned_url
        config.is_enabled = is_enabled
        config.last_sync_error = None
        db.add(config)
        await db.commit()
        await db.refresh(config)

        return {
            'channel': config.channel,
            'is_enabled': bool(config.is_enabled),
            'import_ical_url': config.import_ical_url,
            'export_ical_url': self.build_export_url(public_base_url=public_base_url, token=config.export_ical_token),
            'last_synced_at': config.last_synced_at,
            'last_sync_status': config.last_sync_status,
            'last_sync_error': config.last_sync_error,
            'active_events': await self._active_event_count(db, config.id),
        }

    async def rotate_channel_token(
        self,
        db: AsyncSession,
        *,
        property_id: uuid.UUID,
        channel: str,
        public_base_url: str,
    ) -> dict:
        normalized_channel = self._normalize_channel(channel)
        await self._ensure_property_exists(db, property_id)
        config = await self._get_or_create_channel_config(db, property_id=property_id, channel=normalized_channel)
        config.export_ical_token = await self._generate_unique_export_token(db)
        db.add(config)
        await db.commit()
        await db.refresh(config)

        return {
            'channel': config.channel,
            'is_enabled': bool(config.is_enabled),
            'import_ical_url': config.import_ical_url,
            'export_ical_url': self.build_export_url(public_base_url=public_base_url, token=config.export_ical_token),
            'last_synced_at': config.last_synced_at,
            'last_sync_status': config.last_sync_status,
            'last_sync_error': config.last_sync_error,
            'active_events': await self._active_event_count(db, config.id),
        }

    async def sync_property_channel(
        self,
        db: AsyncSession,
        *,
        property_id: uuid.UUID,
        channel: str,
    ) -> ChannelSyncResult:
        normalized_channel = self._normalize_channel(channel)
        await self._ensure_property_exists(db, property_id)
        config = await self._get_or_create_channel_config(db, property_id=property_id, channel=normalized_channel)
        return await self._sync_channel_config(db=db, config=config)

    async def sync_all_channels(self, db: AsyncSession) -> list[ChannelSyncResult]:
        rows = await db.execute(
            select(PropertyChannelCalendar).where(
                PropertyChannelCalendar.deleted_at.is_(None),
                PropertyChannelCalendar.is_enabled.is_(True),
                PropertyChannelCalendar.import_ical_url.is_not(None),
            )
        )
        configs = list(rows.scalars().all())
        results: list[ChannelSyncResult] = []
        for config in configs:
            result = await self._sync_channel_config(db=db, config=config)
            results.append(result)
        return results

    async def render_ics_by_token(self, db: AsyncSession, token: str) -> str:
        token_value = token.strip()
        if not token_value:
            raise ValueError('Calendar token is required')

        result = await db.execute(
            select(PropertyChannelCalendar).where(
                PropertyChannelCalendar.export_ical_token == token_value,
                PropertyChannelCalendar.deleted_at.is_(None),
            )
        )
        config = result.scalar_one_or_none()
        if config is None:
            raise ValueError('Calendar token not found')

        property_result = await db.execute(
            select(Property).where(Property.id == config.property_id, Property.deleted_at.is_(None))
        )
        property_obj = property_result.scalar_one_or_none()
        if property_obj is None:
            raise ValueError('Property not found')

        today = datetime.now(UTC).date()
        from_date = today - timedelta(days=2)
        to_date = today + timedelta(days=730)
        ranges = await self.property_service.get_blocked_ranges(
            db=db,
            property_id=property_obj.id,
            from_date=from_date,
            to_date=to_date,
            exclude_external_channel=config.channel,
        )

        now_utc = datetime.now(UTC)
        lines = [
            'BEGIN:VCALENDAR',
            'PRODID:-//Premium House//Channel Calendar//EN',
            'VERSION:2.0',
            'CALSCALE:GREGORIAN',
            f'X-WR-CALNAME:{self._escape_ical_text(property_obj.title)}',
            'X-WR-TIMEZONE:Asia/Tashkent',
        ]

        for item in ranges:
            if item.end_date <= item.start_date:
                continue
            uid = self._range_uid(item=item, property_id=property_obj.id)
            summary = item.label or f'{item.source} reserved'
            description = item.note or f'Source={item.source}; Status={item.status}'
            lines.extend(
                [
                    'BEGIN:VEVENT',
                    f'UID:{uid}',
                    f'DTSTAMP:{now_utc.strftime("%Y%m%dT%H%M%SZ")}',
                    f'DTSTART;VALUE=DATE:{item.start_date.strftime("%Y%m%d")}',
                    f'DTEND;VALUE=DATE:{item.end_date.strftime("%Y%m%d")}',
                    f'SUMMARY:{self._escape_ical_text(summary)}',
                    f'DESCRIPTION:{self._escape_ical_text(description)}',
                    'END:VEVENT',
                ]
            )

        lines.append('END:VCALENDAR')
        return '\r\n'.join(lines) + '\r\n'

    def build_export_url(self, *, public_base_url: str, token: str) -> str:
        base = (settings.public_base_url or public_base_url).rstrip('/')
        return f'{base}{settings.api_prefix}/integrations/ical/{token}.ics'

    async def _sync_channel_config(self, db: AsyncSession, config: PropertyChannelCalendar) -> ChannelSyncResult:
        now = datetime.now(UTC)
        if not config.is_enabled:
            return ChannelSyncResult(
                channel=config.channel,
                imported_count=0,
                updated_count=0,
                deactivated_count=0,
                status='disabled',
                error=None,
                synced_at=config.last_synced_at,
            )
        if not config.import_ical_url:
            return ChannelSyncResult(
                channel=config.channel,
                imported_count=0,
                updated_count=0,
                deactivated_count=0,
                status='skipped_no_import_url',
                error=None,
                synced_at=config.last_synced_at,
            )

        lock_key = f'lock:channel-sync:{config.id}'
        async with redis_lock(lock_key, timeout_seconds=20) as acquired:
            if not acquired:
                return ChannelSyncResult(
                    channel=config.channel,
                    imported_count=0,
                    updated_count=0,
                    deactivated_count=0,
                    status='locked',
                    error='sync already in progress',
                    synced_at=config.last_synced_at,
                )

            headers: dict[str, str] = {}
            if config.last_sync_etag:
                headers['If-None-Match'] = config.last_sync_etag
            if config.last_sync_last_modified:
                headers['If-Modified-Since'] = config.last_sync_last_modified

            try:
                async with httpx.AsyncClient(timeout=settings.channel_sync_fetch_timeout_seconds, follow_redirects=True) as client:
                    response = await client.get(config.import_ical_url, headers=headers)
                if response.status_code == 304:
                    config.last_synced_at = now
                    config.last_sync_status = 'not_modified'
                    config.last_sync_error = None
                    db.add(config)
                    await db.commit()
                    return ChannelSyncResult(
                        channel=config.channel,
                        imported_count=0,
                        updated_count=0,
                        deactivated_count=0,
                        status='not_modified',
                        error=None,
                        synced_at=config.last_synced_at,
                    )
                response.raise_for_status()
                events = self._parse_ical_events(response.text)
            except Exception as exc:
                config.last_synced_at = now
                config.last_sync_status = 'failed'
                config.last_sync_error = str(exc)[:1000]
                db.add(config)
                await db.commit()
                return ChannelSyncResult(
                    channel=config.channel,
                    imported_count=0,
                    updated_count=0,
                    deactivated_count=0,
                    status='failed',
                    error=config.last_sync_error,
                    synced_at=config.last_synced_at,
                )

            existing_result = await db.execute(
                select(ExternalCalendarEvent).where(
                    ExternalCalendarEvent.channel_calendar_id == config.id,
                )
            )
            existing_rows = list(existing_result.scalars().all())
            existing_map = {row.external_uid: row for row in existing_rows}
            seen_uids: set[str] = set()
            imported_count = 0
            updated_count = 0
            deactivated_count = 0

            for event in events:
                if event.end_date <= event.start_date:
                    continue
                uid = event.uid[:255]
                if uid in seen_uids:
                    continue
                seen_uids.add(uid)
                row = existing_map.get(uid)
                payload = {
                    'summary': event.summary,
                    'description': event.description,
                    'dtstart_raw': event.dtstart_raw,
                    'dtend_raw': event.dtend_raw,
                }
                if row is None:
                    db.add(
                        ExternalCalendarEvent(
                            property_id=config.property_id,
                            channel_calendar_id=config.id,
                            external_uid=uid,
                            start_date=event.start_date,
                            end_date=event.end_date,
                            summary=event.summary,
                            raw_payload=payload,
                            last_seen_at=now,
                        )
                    )
                    imported_count += 1
                    continue

                changed = (
                    row.start_date != event.start_date
                    or row.end_date != event.end_date
                    or row.summary != event.summary
                    or row.deleted_at is not None
                )
                row.start_date = event.start_date
                row.end_date = event.end_date
                row.summary = event.summary
                row.raw_payload = payload
                row.last_seen_at = now
                row.deleted_at = None
                if changed:
                    updated_count += 1
                db.add(row)

            for row in existing_rows:
                if row.external_uid in seen_uids:
                    continue
                if row.deleted_at is None:
                    row.deleted_at = now
                    db.add(row)
                    deactivated_count += 1

            config.last_synced_at = now
            config.last_sync_status = 'success'
            config.last_sync_error = None
            config.last_sync_etag = response.headers.get('ETag')
            config.last_sync_last_modified = response.headers.get('Last-Modified')
            db.add(config)
            await db.commit()
            return ChannelSyncResult(
                channel=config.channel,
                imported_count=imported_count,
                updated_count=updated_count,
                deactivated_count=deactivated_count,
                status='success',
                error=None,
                synced_at=config.last_synced_at,
            )

    async def _ensure_property_exists(self, db: AsyncSession, property_id: uuid.UUID) -> Property:
        result = await db.execute(select(Property).where(Property.id == property_id, Property.deleted_at.is_(None)))
        property_obj = result.scalar_one_or_none()
        if property_obj is None:
            raise ValueError('Property not found')
        return property_obj

    async def _ensure_channel_configs(self, db: AsyncSession, property_id: uuid.UUID) -> list[PropertyChannelCalendar]:
        result = await db.execute(
            select(PropertyChannelCalendar).where(
                PropertyChannelCalendar.property_id == property_id,
                PropertyChannelCalendar.deleted_at.is_(None),
            )
        )
        existing = list(result.scalars().all())
        by_channel = {item.channel: item for item in existing}
        created = False
        for channel in SUPPORTED_CHANNELS:
            if channel in by_channel:
                continue
            config = PropertyChannelCalendar(
                property_id=property_id,
                channel=channel,
                export_ical_token=await self._generate_unique_export_token(db),
                is_enabled=True,
            )
            db.add(config)
            by_channel[channel] = config
            created = True
        if created:
            await db.commit()
            result = await db.execute(
                select(PropertyChannelCalendar).where(
                    PropertyChannelCalendar.property_id == property_id,
                    PropertyChannelCalendar.deleted_at.is_(None),
                )
            )
            existing = list(result.scalars().all())
        return existing

    async def _get_or_create_channel_config(
        self,
        db: AsyncSession,
        *,
        property_id: uuid.UUID,
        channel: str,
    ) -> PropertyChannelCalendar:
        rows = await self._ensure_channel_configs(db, property_id)
        for row in rows:
            if row.channel == channel:
                return row
        raise ValueError('Channel config not found')

    async def _generate_unique_export_token(self, db: AsyncSession) -> str:
        while True:
            token = secrets.token_urlsafe(36)
            result = await db.execute(
                select(PropertyChannelCalendar.id).where(PropertyChannelCalendar.export_ical_token == token)
            )
            if result.scalar_one_or_none() is None:
                return token

    async def _active_event_count(self, db: AsyncSession, channel_calendar_id: uuid.UUID) -> int:
        rows = await db.execute(
            select(ExternalCalendarEvent.id).where(
                ExternalCalendarEvent.channel_calendar_id == channel_calendar_id,
                ExternalCalendarEvent.deleted_at.is_(None),
            )
        )
        return len(rows.scalars().all())

    def _normalize_channel(self, channel: str) -> str:
        normalized = channel.strip().lower()
        if normalized not in SUPPORTED_CHANNELS:
            raise ValueError(f'Unsupported channel: {channel}')
        return normalized

    def _parse_ical_events(self, raw_ics: str) -> list[ParsedIcalEvent]:
        unfolded_lines = self._unfold_ical_lines(raw_ics)
        events: list[ParsedIcalEvent] = []
        current: dict[str, str] | None = None
        for line in unfolded_lines:
            upper_line = line.upper()
            if upper_line == 'BEGIN:VEVENT':
                current = {}
                continue
            if upper_line == 'END:VEVENT':
                if not current:
                    continue
                start_date, start_raw = self._extract_ical_date(current, 'DTSTART')
                end_date, end_raw = self._extract_ical_date(current, 'DTEND')
                if start_date is None:
                    current = None
                    continue
                if end_date is None:
                    end_date = start_date + timedelta(days=1)
                uid = current.get('UID')
                if not uid:
                    digest_source = (
                        f'{start_date.isoformat()}:{end_date.isoformat()}:'
                        f'{current.get("SUMMARY", "")}:{current.get("DESCRIPTION", "")}'
                    )
                    digest = hashlib.sha1(digest_source.encode('utf-8')).hexdigest()
                    uid = f'generated-{digest[:24]}'
                events.append(
                    ParsedIcalEvent(
                        uid=uid,
                        start_date=start_date,
                        end_date=end_date,
                        summary=self._decode_ical_text(current.get('SUMMARY')) if current.get('SUMMARY') else None,
                        description=self._decode_ical_text(current.get('DESCRIPTION')) if current.get('DESCRIPTION') else None,
                        dtstart_raw=start_raw,
                        dtend_raw=end_raw,
                    )
                )
                current = None
                continue
            if current is None:
                continue
            key, value = self._split_ical_line(line)
            if key:
                current[key] = value
        return events

    def _extract_ical_date(self, values: dict[str, str], field_prefix: str) -> tuple[date | None, str | None]:
        candidates = [(key, value) for key, value in values.items() if key.startswith(field_prefix)]
        if not candidates:
            return None, None
        key, value = candidates[0]
        return self._parse_ical_date_value(key=key, value=value), value

    def _parse_ical_date_value(self, *, key: str, value: str) -> date | None:
        clean_value = value.strip()
        is_date_value = ';VALUE=DATE' in key.upper() or len(clean_value) == 8
        try:
            if is_date_value:
                return datetime.strptime(clean_value[:8], '%Y%m%d').date()
            if clean_value.endswith('Z'):
                return datetime.strptime(clean_value, '%Y%m%dT%H%M%SZ').date()
            return datetime.strptime(clean_value[:15], '%Y%m%dT%H%M%S').date()
        except ValueError:
            return None

    def _split_ical_line(self, line: str) -> tuple[str, str]:
        if ':' not in line:
            return '', ''
        left, right = line.split(':', 1)
        key = left.split(';', 1)[0].strip().upper()
        return key if key else left.strip().upper(), right

    def _unfold_ical_lines(self, raw_ics: str) -> list[str]:
        lines = raw_ics.replace('\r\n', '\n').replace('\r', '\n').split('\n')
        unfolded: list[str] = []
        for line in lines:
            if not line:
                continue
            if line.startswith((' ', '\t')) and unfolded:
                unfolded[-1] += line[1:]
                continue
            unfolded.append(line)
        return unfolded

    def _decode_ical_text(self, value: str) -> str:
        return (
            value.replace('\\n', '\n')
            .replace('\\N', '\n')
            .replace('\\,', ',')
            .replace('\\;', ';')
            .replace('\\\\', '\\')
            .strip()
        )

    def _escape_ical_text(self, value: str) -> str:
        return value.replace('\\', '\\\\').replace('\n', '\\n').replace(',', '\\,').replace(';', '\\;')

    def _range_uid(self, *, item, property_id: uuid.UUID) -> str:
        if item.source == 'booking' and item.booking_id:
            return f'booking-{item.booking_id}@premiumhouse'
        if item.source == 'manual' and item.id:
            return f'manual-{item.id}@premiumhouse'
        if item.id:
            return f'{item.source}-{item.id}@premiumhouse'
        digest = hashlib.sha1(f'{property_id}:{item.source}:{item.start_date}:{item.end_date}'.encode('utf-8')).hexdigest()
        return f'generated-{digest[:24]}@premiumhouse'
