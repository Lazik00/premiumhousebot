from app.tasks.celery_app import celery_app


@celery_app.task(name='health.ping')
def ping() -> str:
    return 'pong'


# Register tasks
from app.tasks import booking_tasks  # noqa: E402,F401
from app.tasks import integration_tasks  # noqa: E402,F401
