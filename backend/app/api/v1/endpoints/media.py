from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from app.core.config import settings
from app.services.storage_service import StorageService

router = APIRouter(tags=['media'])


@router.get('/media/{object_key:path}')
async def get_media(object_key: str) -> Response:
    storage = StorageService(
        endpoint=str(settings.s3_endpoint) if settings.s3_endpoint else None,
        bucket=settings.s3_bucket,
        access_key=settings.s3_access_key,
        secret_key=settings.s3_secret_key,
    )
    try:
        obj = await storage.get_object(object_key)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    if obj is None:
        raise HTTPException(status_code=404, detail='Media not found')

    return Response(
        content=obj.body,
        media_type=obj.content_type,
        headers={'Cache-Control': 'public, max-age=31536000, immutable'},
    )
