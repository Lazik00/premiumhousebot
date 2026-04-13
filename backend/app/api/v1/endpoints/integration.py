from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.services.calendar_sync_service import CalendarSyncService

router = APIRouter(prefix='/integrations', tags=['integrations'])
calendar_sync_service = CalendarSyncService()


@router.get('/ical/{token}.ics')
async def export_property_calendar(
    token: str,
    db: AsyncSession = Depends(get_db),
) -> Response:
    try:
        calendar = await calendar_sync_service.render_ics_by_token(db, token=token)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return Response(
        content=calendar,
        media_type='text/calendar',
        headers={
            'Cache-Control': 'no-store, no-cache, must-revalidate',
            'Content-Disposition': f'inline; filename="{token}.ics"',
        },
    )
