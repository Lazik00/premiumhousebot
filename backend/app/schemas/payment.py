from datetime import datetime

from pydantic import BaseModel, Field


class PaymentCreateRequest(BaseModel):
    booking_id: str
    provider: str = Field(pattern='^(rahmat|click|payme)$')


class PaymentCreateResponse(BaseModel):
    payment_id: str
    booking_id: str
    provider: str
    status: str
    payment_url: str
    amount: float
    currency: str


class PaymentCallbackRequest(BaseModel):
    provider_event_id: str = Field(min_length=3, max_length=128)
    payment_id: str = Field(min_length=16, max_length=64)
    status: str = Field(pattern='^(success|failed)$')
    payload: dict[str, object]


class PaymentCallbackResponse(BaseModel):
    status: str
    booking_id: str | None
    processed_at: datetime | None = None
