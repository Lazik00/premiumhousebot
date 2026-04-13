import asyncio
import uuid

from app.db.session import AsyncSessionLocal, dispose_engine
from app.services.calendar_sync_service import CalendarSyncService
from app.services.google_sheets_service import GoogleSheetsService
from app.tasks.celery_app import celery_app


async def _sync_external_calendars() -> dict:
    service = CalendarSyncService()
    async with AsyncSessionLocal() as db:
        results = await service.sync_all_channels(db)
        return {
            'total': len(results),
            'success': len([item for item in results if item.status == 'success']),
            'failed': len([item for item in results if item.status == 'failed']),
        }


async def _sync_booking_to_google_sheets(booking_id: str, event_type: str) -> str:
    booking_uuid = uuid.UUID(booking_id)
    service = GoogleSheetsService()
    async with AsyncSessionLocal() as db:
        return await service.append_booking_event(db, booking_id=booking_uuid, event_type=event_type)


@celery_app.task(name='integration.sync_external_calendars')
def sync_external_calendars() -> dict:
    async def _runner() -> dict:
        try:
            return await _sync_external_calendars()
        finally:
            await dispose_engine()

    return asyncio.run(_runner())


@celery_app.task(name='integration.sync_booking_to_google_sheets')
def sync_booking_to_google_sheets(booking_id: str, event_type: str) -> str:
    async def _runner() -> str:
        try:
            return await _sync_booking_to_google_sheets(booking_id=booking_id, event_type=event_type)
        finally:
            await dispose_engine()

    return asyncio.run(_runner())
