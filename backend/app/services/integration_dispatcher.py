import uuid


def enqueue_booking_sheet_export(booking_id: uuid.UUID, event_type: str) -> None:
    try:
        from app.tasks.integration_tasks import sync_booking_to_google_sheets

        sync_booking_to_google_sheets.delay(str(booking_id), event_type)
    except Exception:
        # Integration delivery is best-effort and should not block booking flow.
        return
