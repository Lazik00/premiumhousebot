from fastapi import APIRouter

from app.api.v1.endpoints import (
    admin_router,
    app_config_router,
    auth_router,
    booking_router,
    health_router,
    integration_router,
    media_router,
    payment_router,
    property_router,
    telegram_router,
)

router = APIRouter()
router.include_router(health_router)
router.include_router(app_config_router)
router.include_router(media_router)
router.include_router(auth_router)
router.include_router(admin_router)
router.include_router(property_router)
router.include_router(integration_router)
router.include_router(booking_router)
router.include_router(payment_router)
router.include_router(telegram_router)
