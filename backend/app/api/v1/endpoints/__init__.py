from app.api.v1.endpoints.auth import router as auth_router
from app.api.v1.endpoints.booking import router as booking_router
from app.api.v1.endpoints.health import router as health_router
from app.api.v1.endpoints.payment import router as payment_router
from app.api.v1.endpoints.property import router as property_router

__all__ = ['auth_router', 'booking_router', 'health_router', 'payment_router', 'property_router']
