from datetime import date, datetime

from pydantic import BaseModel, Field


class StatusCountResponse(BaseModel):
    status: str
    count: int


class RevenuePointResponse(BaseModel):
    day: date
    amount: float


class AdminDashboardKPIResponse(BaseModel):
    total_bookings: int
    active_bookings: int
    active_listings: int
    pending_listings: int
    total_users: int
    total_hosts: int
    pending_payments: int
    gross_revenue: float
    platform_commission: float
    host_earnings: float


class AdminRecentBookingResponse(BaseModel):
    id: str
    booking_code: str
    status: str
    total_price: float
    start_date: date
    end_date: date
    created_at: datetime
    customer_name: str
    property_title: str


class AdminRecentPropertyResponse(BaseModel):
    id: str
    title: str
    city: str
    host_name: str
    property_type: str
    status: str
    created_at: datetime
    price_per_night: float


class AdminDashboardResponse(BaseModel):
    kpis: AdminDashboardKPIResponse
    booking_statuses: list[StatusCountResponse]
    payment_statuses: list[StatusCountResponse]
    revenue_series: list[RevenuePointResponse]
    recent_bookings: list[AdminRecentBookingResponse]
    recent_properties: list[AdminRecentPropertyResponse]


class AdminUserResponse(BaseModel):
    id: str
    first_name: str
    last_name: str | None
    username: str | None
    email: str | None
    phone: str | None
    telegram_id: int | None
    status: str
    roles: list[str]
    total_bookings: int
    created_at: datetime
    last_login_at: datetime | None


class AdminUserListResponse(BaseModel):
    items: list[AdminUserResponse]
    total: int
    limit: int
    offset: int


class AdminUserStatusUpdateRequest(BaseModel):
    status: str = Field(pattern='^(active|blocked|pending)$')


class AdminPropertyImageInput(BaseModel):
    image_url: str = Field(min_length=5, max_length=2000)
    object_key: str | None = Field(default=None, max_length=255)
    is_cover: bool = False
    sort_order: int = Field(default=1, ge=1, le=1000)


class AdminPropertyImageResponse(BaseModel):
    id: str
    image_url: str
    object_key: str
    is_cover: bool
    sort_order: int


class AdminUploadedImageResponse(BaseModel):
    object_key: str
    image_url: str
    original_name: str
    content_type: str
    size: int


class AdminAmenityOptionResponse(BaseModel):
    id: str
    code: str
    name_uz: str
    icon: str | None


class AdminPropertyResponse(BaseModel):
    id: str
    title: str
    city: str
    region: str
    host_name: str
    property_type: str
    status: str
    capacity: int
    price_per_night: float
    average_rating: float
    review_count: int
    created_at: datetime


class AdminPropertyDetailResponse(BaseModel):
    id: str
    host_id: str
    host_name: str
    title: str
    description: str
    address: str
    region_id: str
    region: str
    city_id: str
    city: str
    latitude: float
    longitude: float
    property_type: str
    capacity: int
    rooms: int
    bathrooms: int
    total_area_sqm: float | None = None
    floor: int | None = None
    total_floors: int | None = None
    bedrooms: int | None = None
    beds: int | None = None
    price_per_night: float
    currency: str
    cancellation_policy: str | None
    house_rules: str | None
    status: str
    average_rating: float
    review_count: int
    images: list[AdminPropertyImageResponse]
    amenities: list[AdminAmenityOptionResponse]
    created_at: datetime
    updated_at: datetime


class AdminPropertyCreateRequest(BaseModel):
    host_id: str
    region_id: str
    city_id: str
    title: str = Field(min_length=3, max_length=180)
    description: str | None = Field(default=None, max_length=5000)
    address: str = Field(min_length=5, max_length=1000)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    property_type: str = Field(pattern='^(apartment|house|villa)$')
    capacity: int = Field(ge=1, le=50)
    rooms: int = Field(ge=1, le=50)
    bathrooms: int = Field(ge=1, le=50)
    total_area_sqm: float | None = Field(default=None, ge=0)
    floor: int | None = Field(default=None, ge=0, le=200)
    total_floors: int | None = Field(default=None, ge=1, le=200)
    bedrooms: int | None = Field(default=None, ge=0, le=50)
    beds: int | None = Field(default=None, ge=0, le=100)
    price_per_night: float = Field(gt=0)
    currency: str = Field(default='UZS', min_length=3, max_length=3)
    cancellation_policy: str | None = Field(default=None, max_length=2000)
    house_rules: str | None = Field(default=None, max_length=2000)
    status: str = Field(default='draft', pattern='^(draft|pending_review|active|blocked|archived)$')
    amenity_ids: list[str] = Field(default_factory=list)
    images: list[AdminPropertyImageInput] = Field(default_factory=list)


class AdminPropertyUpdateRequest(AdminPropertyCreateRequest):
    pass


class AdminPropertyListResponse(BaseModel):
    items: list[AdminPropertyResponse]
    total: int
    limit: int
    offset: int


class AdminPropertyStatusUpdateRequest(BaseModel):
    status: str = Field(pattern='^(draft|pending_review|active|blocked|archived)$')


class AdminPropertyAvailabilityBlockResponse(BaseModel):
    id: str | None = None
    source: str
    status: str
    start_date: date
    end_date: date
    label: str | None = None
    note: str | None = None
    booking_id: str | None = None
    booking_code: str | None = None
    can_delete: bool = False
    created_at: datetime | None = None


class AdminPropertyAvailabilityResponse(BaseModel):
    property_id: str
    blocked_ranges: list[AdminPropertyAvailabilityBlockResponse]


class AdminPropertyAvailabilityCreateRequest(BaseModel):
    start_date: date
    end_date: date
    note: str | None = Field(default=None, max_length=500)


class AdminChannelCalendarConfigResponse(BaseModel):
    channel: str
    is_enabled: bool
    import_ical_url: str | None = None
    export_ical_url: str
    last_synced_at: datetime | None = None
    last_sync_status: str | None = None
    last_sync_error: str | None = None
    active_events: int = 0


class AdminChannelCalendarListResponse(BaseModel):
    property_id: str
    channels: list[AdminChannelCalendarConfigResponse]


class AdminChannelCalendarUpdateRequest(BaseModel):
    import_ical_url: str | None = Field(default=None, max_length=2000)
    is_enabled: bool = True


class AdminChannelCalendarSyncResponse(BaseModel):
    channel: str
    imported_count: int
    updated_count: int
    deactivated_count: int
    status: str
    error: str | None = None
    synced_at: datetime | None = None


class AdminBookingResponse(BaseModel):
    id: str
    booking_code: str
    status: str
    start_date: date
    end_date: date
    total_nights: int
    guests_total: int
    total_price: float
    currency: str
    expires_at: datetime | None
    confirmed_at: datetime | None
    created_at: datetime
    customer_name: str
    property_title: str
    payment_provider: str | None = None
    payment_status: str | None = None


class AdminBookingEventResponse(BaseModel):
    id: str
    event_type: str
    old_status: str | None
    new_status: str | None
    event_payload: dict[str, object]
    created_at: datetime


class AdminBookingPaymentSummaryResponse(BaseModel):
    id: str
    provider: str
    status: str
    amount: float
    currency: str
    payment_method_id: str | None = None
    payment_method_brand: str | None = None
    payment_method_name: str | None = None
    payment_method_card_holder: str | None = None
    payment_method_card_number: str | None = None
    customer_note: str | None = None
    payment_url: str | None
    provider_payment_id: str | None
    created_at: datetime
    paid_at: datetime | None


class AdminBookingDetailResponse(BaseModel):
    id: str
    booking_code: str
    status: str
    start_date: date
    end_date: date
    total_nights: int
    guests_total: int
    guests_adults_men: int
    guests_adults_women: int
    guests_children: int
    total_price: float
    currency: str
    expires_at: datetime | None
    confirmed_at: datetime | None
    cancelled_at: datetime | None
    cancel_reason: str | None
    created_at: datetime
    customer: AdminUserResponse
    property: AdminPropertyResponse
    payments: list[AdminBookingPaymentSummaryResponse]
    events: list[AdminBookingEventResponse]


class AdminBookingListResponse(BaseModel):
    items: list[AdminBookingResponse]
    total: int
    limit: int
    offset: int


class AdminPaymentCallbackResponse(BaseModel):
    id: str
    provider_event_id: str
    signature: str
    is_valid: bool
    processed_at: datetime | None
    created_at: datetime
    payload: dict[str, object]


class AdminRefundResponse(BaseModel):
    id: str
    amount: float
    status: str
    reason: str | None
    provider_refund_id: str | None
    processed_at: datetime | None
    created_at: datetime


class AdminPaymentResponse(BaseModel):
    id: str
    booking_id: str
    booking_code: str
    provider: str
    payment_method_id: str | None = None
    payment_method_brand: str | None = None
    payment_method_name: str | None = None
    payment_method_card_number: str | None = None
    provider_payment_id: str | None
    status: str
    amount: float
    currency: str
    payment_url: str | None
    customer_name: str
    property_title: str
    created_at: datetime
    paid_at: datetime | None


class AdminPaymentDetailResponse(BaseModel):
    id: str
    booking_id: str
    booking_code: str
    provider: str
    payment_method_id: str | None = None
    payment_method_brand: str | None = None
    payment_method_name: str | None = None
    payment_method_card_holder: str | None = None
    payment_method_card_number: str | None = None
    provider_payment_id: str | None
    status: str
    amount: float
    currency: str
    payment_url: str | None
    raw_request: dict[str, object]
    raw_response: dict[str, object]
    customer_name: str
    customer_email: str | None
    property_title: str
    created_at: datetime
    paid_at: datetime | None
    failed_at: datetime | None
    callbacks: list[AdminPaymentCallbackResponse]
    refunds: list[AdminRefundResponse]


class AdminPaymentListResponse(BaseModel):
    items: list[AdminPaymentResponse]
    total: int
    limit: int
    offset: int


class AdminBookingApprovalRequest(BaseModel):
    note: str | None = Field(default=None, max_length=500)


class AdminBookingActionResponse(BaseModel):
    booking_id: str
    payment_id: str | None = None
    booking_status: str
    payment_status: str | None = None
    confirmed_at: datetime | None = None


class AdminHostBalanceResponse(BaseModel):
    id: str | None
    host_id: str
    host_name: str
    email: str | None
    currency: str
    available_amount: float
    pending_amount: float
    total_earned_amount: float
    total_paid_out_amount: float
    updated_at: datetime | None


class AdminLedgerEntryResponse(BaseModel):
    id: str
    direction: str
    amount: float
    currency: str
    description: str | None
    reference_type: str | None
    reference_id: str | None
    created_at: datetime


class AdminHostBalanceDetailResponse(BaseModel):
    host_id: str
    host_name: str
    email: str | None
    currency: str
    available_amount: float
    pending_amount: float
    total_earned_amount: float
    total_paid_out_amount: float
    updated_at: datetime | None
    ledger_entries: list[AdminLedgerEntryResponse]


class AdminHostBalanceListResponse(BaseModel):
    items: list[AdminHostBalanceResponse]
    total: int
    limit: int
    offset: int


class AdminHostOptionResponse(BaseModel):
    id: str
    label: str
    email: str | None
    username: str | None


class AdminRegionOptionResponse(BaseModel):
    id: str
    name: str


class AdminCityOptionResponse(BaseModel):
    id: str
    region_id: str
    region_name: str
    name: str


class AdminPaymentMethodResponse(BaseModel):
    id: str
    brand: str
    name: str
    card_holder: str
    card_number: str
    instructions: str | None
    is_active: bool
    sort_order: int
    created_at: datetime
    updated_at: datetime


class AdminPaymentMethodCreateRequest(BaseModel):
    brand: str = Field(pattern='^(visa|mastercard|humo|uzcard)$')
    name: str = Field(min_length=2, max_length=120)
    card_holder: str = Field(min_length=2, max_length=120)
    card_number: str = Field(min_length=4, max_length=50)
    instructions: str | None = Field(default=None, max_length=1000)
    is_active: bool = True
    sort_order: int = Field(default=1, ge=1, le=1000)


class AdminPaymentMethodUpdateRequest(AdminPaymentMethodCreateRequest):
    pass


class AdminPaymentMethodListResponse(BaseModel):
    items: list[AdminPaymentMethodResponse]


class AdminMetaOptionsResponse(BaseModel):
    hosts: list[AdminHostOptionResponse]
    regions: list[AdminRegionOptionResponse]
    cities: list[AdminCityOptionResponse]
    amenities: list[AdminAmenityOptionResponse]
