from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class BookingCreateRequest(BaseModel):
    property_id: str
    start_date: date
    end_date: date
    guests_total: int = Field(default=1, ge=1)
    guests_adults_men: int = Field(default=0, ge=0)
    guests_adults_women: int = Field(default=0, ge=0)
    guests_children: int = Field(default=0, ge=0)


class BookingCancelRequest(BaseModel):
    reason: str = Field(min_length=1, max_length=500)


class BookingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    booking_code: str
    user_id: str
    property_id: str
    start_date: date
    end_date: date
    total_nights: int
    guests_total: int
    guests_adults_men: int
    guests_adults_women: int
    guests_children: int
    price_per_night_snapshot: float
    total_price: float
    status: str
    expires_at: datetime | None
    confirmed_at: datetime | None
    cancelled_at: datetime | None
    created_at: datetime


class BookingListResponse(BaseModel):
    items: list[BookingResponse]
    total: int
    limit: int
    offset: int
