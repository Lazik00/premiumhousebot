from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class PaymentCreateRequest(BaseModel):
    booking_id: str
    provider: str = Field(pattern='^(rahmat|click|payme|octo)$')


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


class PaymentRefundRequest(BaseModel):
    amount: float | None = Field(default=None, gt=0)
    reason: str | None = Field(default=None, max_length=1000)


class PaymentRefundResponse(BaseModel):
    refund_id: str
    payment_id: str
    booking_id: str
    provider: str
    status: str
    amount: float
    provider_refund_id: str | None
    processed_at: datetime | None = None


class OctoCallbackRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    shop_transaction_id: str = Field(min_length=3, max_length=128)
    octo_payment_uuid: str = Field(alias='octo_payment_UUID', min_length=16, max_length=128)
    status: str = Field(min_length=3, max_length=64)
    signature: str = Field(min_length=8, max_length=255)
    hash_key: str | None = Field(default=None, max_length=255)
    total_sum: float | None = None
    transfer_sum: float | None = None
    refunded_sum: float | None = None
    card_country: str | None = Field(default=None, max_length=8)
    masked_pan: str | None = Field(default=None, alias='maskedPan', max_length=64)
    rrn: str | None = Field(default=None, max_length=64)
    risk_level: int | None = Field(default=None, alias='riskLevel')
    payed_time: str | None = Field(default=None, max_length=64)
    card_type: str | None = Field(default=None, max_length=64)
    currency: str | None = Field(default=None, max_length=8)
    card_vendor: str | None = Field(default=None, max_length=64)
    is_physical_card: bool | None = None
