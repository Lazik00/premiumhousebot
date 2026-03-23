from celery import Celery

from app.core.config import settings

celery_app = Celery(
    'premium_house',
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
)

celery_app.conf.update(
    timezone='Asia/Tashkent',
    enable_utc=True,
    broker_connection_retry_on_startup=True,
    beat_schedule={
        'expire-pending-bookings-every-minute': {
            'task': 'booking.expire_pending',
            'schedule': 60.0,
        }
    },
)
