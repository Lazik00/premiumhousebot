from app.api.v1.endpoints.app_config import router as app_config_router
from app.api.v1.endpoints.admin import router as admin_router
from app.api.v1.endpoints.auth import router as auth_router
from app.api.v1.endpoints.booking import router as booking_router
from app.api.v1.endpoints.health import router as health_router
from app.api.v1.endpoints.media import router as media_router
from app.api.v1.endpoints.payment import router as payment_router
from app.api.v1.endpoints.property import router as property_router

__all__ = ['admin_router', 'app_config_router', 'auth_router', 'booking_router', 'health_router', 'media_router', 'payment_router', 'property_router']
