from fastapi import APIRouter, Header, HTTPException, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import AsyncSessionLocal
from app.services.telegram_bot_service import TelegramBotService

router = APIRouter(prefix='/telegram', tags=['telegram'])
telegram_bot_service = TelegramBotService()


@router.post('/webhook', status_code=status.HTTP_200_OK)
async def telegram_webhook(
    request: Request,
    response: Response,
    x_telegram_bot_api_secret_token: str | None = Header(default=None, alias='X-Telegram-Bot-Api-Secret-Token'),
) -> dict[str, bool]:
    from app.core.config import settings

    if settings.telegram_webhook_secret and x_telegram_bot_api_secret_token != settings.telegram_webhook_secret:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Invalid webhook secret')

    payload = await request.json()
    async with AsyncSessionLocal() as db:
        await telegram_bot_service.handle_update(db, payload)
    return {'ok': True}
