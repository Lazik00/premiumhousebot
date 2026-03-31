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
    imports=('app.tasks.booking_tasks',),
    beat_schedule={
        'expire-pending-bookings-every-minute': {
            'task': 'booking.expire_pending',
            'schedule': 60.0,
        },
        'complete-finished-bookings-every-five-minutes': {
            'task': 'booking.complete_finished',
            'schedule': 300.0,
        },
        'send-review-prompts-every-five-minutes': {
            'task': 'booking.send_review_prompts',
            'schedule': 300.0,
        },
    },
)
