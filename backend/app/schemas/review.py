from datetime import datetime

from pydantic import BaseModel


class PropertyReviewResponse(BaseModel):
    id: str
    booking_id: str
    rating: int
    comment: str | None = None
    host_reply: str | None = None
    author_name: str
    created_at: datetime
