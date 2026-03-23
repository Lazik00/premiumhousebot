from fastapi import APIRouter

from app.api.v1.endpoints import auth_router, booking_router, health_router, payment_router, property_router

router = APIRouter()
router.include_router(health_router)
router.include_router(auth_router)
router.include_router(property_router)
router.include_router(booking_router)
router.include_router(payment_router)
