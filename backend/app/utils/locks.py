import uuid
from contextlib import asynccontextmanager
from typing import AsyncIterator

from app.db.redis import redis_client

UNLOCK_SCRIPT = """
if redis.call('get', KEYS[1]) == ARGV[1] then
    return redis.call('del', KEYS[1])
else
    return 0
end
"""


@asynccontextmanager
async def redis_lock(key: str, timeout_seconds: int = 15) -> AsyncIterator[bool]:
    token = str(uuid.uuid4())
    acquired = bool(await redis_client.set(key, token, nx=True, ex=timeout_seconds))
    try:
        yield acquired
    finally:
        if acquired:
            await redis_client.eval(UNLOCK_SCRIPT, 1, key, token)
