from datetime import datetime

from pydantic import BaseModel


class ExchangeRateResponse(BaseModel):
    usd_to_uzs: float
    effective_date: str
    fetched_at: datetime
    source: str


class PublicAppConfigResponse(BaseModel):
    default_language: str
    default_currency: str
    available_languages: list[str]
    available_currencies: list[str]
    exchange_rate: ExchangeRateResponse
