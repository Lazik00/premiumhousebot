from fastapi import APIRouter

from app.schemas.app_config import PublicAppConfigResponse
from app.services.app_config_service import AppConfigService

router = APIRouter(prefix='/app-config', tags=['app-config'])
app_config_service = AppConfigService()


@router.get('', response_model=PublicAppConfigResponse)
async def get_app_config() -> PublicAppConfigResponse:
    return await app_config_service.get_public_config()
