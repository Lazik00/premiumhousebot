/* ===== API Response Types ===== */

export type LanguageCode = 'uz' | 'ru' | 'en';
export type CurrencyCode = 'UZS' | 'USD';

export interface AppConfigResponse {
    default_language: LanguageCode;
    default_currency: CurrencyCode;
    available_languages: LanguageCode[];
    available_currencies: CurrencyCode[];
    exchange_rate: {
        usd_to_uzs: number;
        effective_date: string;
        fetched_at: string;
        source: string;
    };
}

export interface PropertyImage {
    id: string;
    image_url: string;
    is_cover: boolean;
    sort_order: number;
}

export interface Amenity {
    id: string;
    code: string;
    name_uz: string;
    name_ru?: string;
    name_en?: string;
    icon?: string;
}

export interface HostBrief {
    id: string;
    first_name: string;
    last_name?: string;
    photo_url?: string;
}

export interface PropertySummary {
    id: string;
    title: string;
    description: string;
    address: string;
    region: string;
    city: string;
    latitude: number;
    longitude: number;
    property_type: 'apartment' | 'house' | 'villa';
    capacity: number;
    rooms: number;
    bathrooms: number;
    price_per_night: number;
    currency: string;
    cleaning_fee: number;
    service_fee: number;
    average_rating: number;
    review_count: number;
    cover_image?: string;
}

export interface PropertyDetail extends PropertySummary {
    cancellation_policy?: string;
    house_rules?: string;
    images: PropertyImage[];
    amenities: Amenity[];
    host?: HostBrief;
}

export interface PropertyListResponse {
    items: PropertySummary[];
    total: number;
    limit: number;
    offset: number;
}

export interface BlockedRange {
    id?: string | null;
    start_date: string;
    end_date: string;
    status: string;
    source?: 'booking' | 'manual' | string;
    label?: string | null;
    note?: string | null;
    booking_id?: string | null;
    created_at?: string | null;
}

export interface PropertyAvailability {
    property_id: string;
    blocked_ranges: BlockedRange[];
}

/* ===== Auth ===== */

export interface AuthUser {
    id: string;
    telegram_id: number;
    first_name: string;
    last_name?: string;
    username?: string;
    photo_url?: string;
}

export interface TokenPair {
    access_token: string;
    refresh_token: string;
    token_type: string;
    expires_in: number;
}

export interface TelegramAuthResponse extends TokenPair {
    user: AuthUser;
}

export interface UserMe {
    id: string;
    telegram_id: number;
    first_name: string;
    last_name?: string;
    username?: string;
    photo_url?: string;
    status: string;
    created_at: string;
}

/* ===== Booking ===== */

export interface Booking {
    id: string;
    booking_code: string;
    user_id: string;
    property_id: string;
    start_date: string;
    end_date: string;
    total_nights: number;
    guests_total: number;
    guests_adults_men: number;
    guests_adults_women: number;
    guests_children: number;
    price_per_night_snapshot: number;
    total_price: number;
    status: 'pending_payment' | 'confirmed' | 'cancelled' | 'completed' | 'expired';
    expires_at?: string;
    confirmed_at?: string;
    cancelled_at?: string;
    created_at: string;
}

export interface BookingListResponse {
    items: Booking[];
    total: number;
    limit: number;
    offset: number;
}

/* ===== Payment ===== */

export interface PaymentCreateResponse {
    payment_id: string;
    booking_id: string;
    provider: string;
    status: string;
    payment_url: string;
    amount: number;
    currency: string;
}
