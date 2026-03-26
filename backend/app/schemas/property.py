from datetime import date, datetime

from pydantic import BaseModel


class PropertyImageResponse(BaseModel):
    id: str
    image_url: str
    is_cover: bool
    sort_order: int


class AmenityResponse(BaseModel):
    id: str
    code: str
    name_uz: str
    name_ru: str | None = None
    name_en: str | None = None
    icon: str | None = None


class HostBriefResponse(BaseModel):
    id: str
    first_name: str
    last_name: str | None = None
    photo_url: str | None = None


class PropertySummaryResponse(BaseModel):
    id: str
    title: str
    description: str
    address: str
    region: str
    city: str
    latitude: float
    longitude: float
    property_type: str
    capacity: int
    rooms: int
    bathrooms: int
    price_per_night: float
    currency: str
    cleaning_fee: float
    service_fee: float
    average_rating: float
    review_count: int
    cover_image: str | None = None


class PropertyDetailResponse(PropertySummaryResponse):
    cancellation_policy: str | None
    house_rules: str | None
    images: list[PropertyImageResponse] = []
    amenities: list[AmenityResponse] = []
    host: HostBriefResponse | None = None


class PropertyListResponse(BaseModel):
    items: list[PropertySummaryResponse]
    total: int
    limit: int
    offset: int


class BlockedRangeResponse(BaseModel):
    id: str | None = None
    start_date: date
    end_date: date
    status: str
    source: str = 'booking'
    label: str | None = None
    note: str | None = None
    booking_id: str | None = None
    created_at: datetime | None = None


class PropertyAvailabilityResponse(BaseModel):
    property_id: str
    blocked_ranges: list[BlockedRangeResponse]
