from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import router as v1_router
from app.core.config import settings
from app.core.rate_limit import init_rate_limiter
from app.db.redis import close_redis
from app.db.session import AsyncSessionLocal, dispose_engine
from app.services.auth_service import AuthService
from app.services.telegram_bot_service import TelegramBotService


@asynccontextmanager
async def lifespan(_: FastAPI):
    async with AsyncSessionLocal() as session:
        await AuthService().ensure_bootstrap_admin(session)
    await TelegramBotService().ensure_webhook()
    yield
    await close_redis()
    await dispose_engine()


app = FastAPI(
    title=settings.app_name,
    debug=settings.debug,
    lifespan=lifespan,
    docs_url='/api/docs' if settings.swagger_enabled else None,
    redoc_url='/api/redoc' if settings.swagger_enabled else None,
    openapi_url='/api/openapi.json' if settings.swagger_enabled else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

init_rate_limiter(app)
app.include_router(v1_router, prefix=settings.api_prefix)
