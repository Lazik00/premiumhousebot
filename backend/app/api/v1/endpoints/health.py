import asyncio

from fastapi import APIRouter, HTTPException, status

from app.db.redis import ping_redis
from app.db.session import ping_db

router = APIRouter(tags=['ops'])


@router.get('/health')
async def health() -> dict[str, str]:
    return {'status': 'ok'}


@router.get('/ready')
async def ready() -> dict[str, object]:
    db_ok, redis_ok = await asyncio.gather(ping_db(), ping_redis())
    if not (db_ok and redis_ok):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={'status': 'not_ready', 'checks': {'db': db_ok, 'redis': redis_ok}},
        )
    return {'status': 'ready', 'checks': {'db': db_ok, 'redis': redis_ok}}
