import type {
    Booking,
    BookingListResponse,
    PaymentCreateResponse,
    PropertyAvailability,
    PropertyDetail,
    PropertyListResponse,
    TelegramAuthResponse,
    UserMe,
} from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE || '/api/v1';

/* ===== Token storage ===== */

let accessToken: string | null = null;
let refreshToken: string | null = null;

export function setTokens(access: string, refresh: string) {
    accessToken = access;
    refreshToken = refresh;
    if (typeof window !== 'undefined') {
        localStorage.setItem('ph_access_token', access);
        localStorage.setItem('ph_refresh_token', refresh);
    }
}

export function loadTokens() {
    if (typeof window !== 'undefined') {
        accessToken = localStorage.getItem('ph_access_token');
        refreshToken = localStorage.getItem('ph_refresh_token');
    }
}

export function clearTokens() {
    accessToken = null;
    refreshToken = null;
    if (typeof window !== 'undefined') {
        localStorage.removeItem('ph_access_token');
        localStorage.removeItem('ph_refresh_token');
    }
}

export function getAccessToken() {
    return accessToken;
}

function generateIdempotencyKey(seed?: string): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return seed ? `${seed}-${crypto.randomUUID()}` : crypto.randomUUID();
    }
    const random = Math.random().toString(36).slice(2, 12);
    const timestamp = Date.now().toString(36);
    return seed ? `${seed}-${timestamp}-${random}` : `${timestamp}-${random}`;
}

/* ===== HTTP client ===== */

async function request<T>(
    path: string,
    options: RequestInit = {},
    requireAuth = false,
): Promise<T> {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string> || {}),
    };

    if (requireAuth && accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers,
    });

    if (res.status === 401 && requireAuth && refreshToken) {
        const refreshed = await tryRefresh();
        if (refreshed) {
            headers['Authorization'] = `Bearer ${accessToken}`;
            const retryRes = await fetch(`${API_BASE}${path}`, { ...options, headers });
            if (!retryRes.ok) {
                throw new ApiError(retryRes.status, await retryRes.text());
            }
            return retryRes.json();
        }
        clearTokens();
        throw new ApiError(401, 'Auth expired');
    }

    if (!res.ok) {
        throw new ApiError(res.status, await res.text());
    }

    if (res.status === 204) return undefined as T;
    return res.json();
}

async function tryRefresh(): Promise<boolean> {
    try {
        const res = await fetch(`${API_BASE}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: refreshToken }),
        });
        if (!res.ok) return false;
        const data = await res.json();
        setTokens(data.access_token, data.refresh_token);
        return true;
    } catch {
        return false;
    }
}

export class ApiError extends Error {
    status: number;
    constructor(status: number, body: string) {
        super(`API ${status}: ${body}`);
        this.status = status;
    }
}

/* ===== Auth ===== */

export async function loginWithTelegram(initData: string): Promise<TelegramAuthResponse> {
    const data = await request<TelegramAuthResponse>('/auth/telegram', {
        method: 'POST',
        body: JSON.stringify({ initData }),
    });
    setTokens(data.access_token, data.refresh_token);
    return data;
}

export async function getMe(): Promise<UserMe> {
    return request<UserMe>('/auth/me', {}, true);
}

export async function logout(): Promise<void> {
    if (refreshToken) {
        await request('/auth/logout', {
            method: 'POST',
            body: JSON.stringify({ refresh_token: refreshToken }),
        }, true).catch(() => { });
    }
    clearTokens();
}

/* ===== Properties ===== */

interface ListPropertiesParams {
    city?: string;
    min_price?: number;
    max_price?: number;
    guests?: number;
    check_in?: string;
    check_out?: string;
    limit?: number;
    offset?: number;
}

export async function listProperties(params: ListPropertiesParams = {}): Promise<PropertyListResponse> {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
    });
    const query = qs.toString();
    return request<PropertyListResponse>(`/properties${query ? '?' + query : ''}`);
}

export async function getProperty(id: string): Promise<PropertyDetail> {
    return request<PropertyDetail>(`/properties/${id}`);
}

export async function getPropertyAvailability(
    id: string,
    fromDate?: string,
    toDate?: string,
): Promise<PropertyAvailability> {
    const qs = new URLSearchParams();
    if (fromDate) qs.set('from_date', fromDate);
    if (toDate) qs.set('to_date', toDate);
    const query = qs.toString();
    return request<PropertyAvailability>(`/properties/${id}/availability${query ? '?' + query : ''}`);
}

/* ===== Bookings ===== */

export async function createBooking(
    propertyId: string,
    startDate: string,
    endDate: string,
    guestsTotal: number,
    guestsAdultsMen: number = 0,
    guestsAdultsWomen: number = 0,
    guestsChildren: number = 0,
): Promise<Booking> {
    const idempotencyKey = generateIdempotencyKey('booking');
    return request<Booking>('/bookings', {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify({
            property_id: propertyId,
            start_date: startDate,
            end_date: endDate,
            guests_total: guestsTotal,
            guests_adults_men: guestsAdultsMen,
            guests_adults_women: guestsAdultsWomen,
            guests_children: guestsChildren,
        }),
    }, true);
}

export async function getMyBookings(limit = 20, offset = 0): Promise<BookingListResponse> {
    return request<BookingListResponse>(`/bookings/my?limit=${limit}&offset=${offset}`, {}, true);
}

export async function getBooking(id: string): Promise<Booking> {
    return request<Booking>(`/bookings/${id}`, {}, true);
}

export async function cancelBooking(id: string, reason: string): Promise<Booking> {
    return request<Booking>(`/bookings/${id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
    }, true);
}

/* ===== Payments ===== */

export async function createPaymentLink(
    bookingId: string,
    provider: 'click' | 'payme' | 'rahmat',
): Promise<PaymentCreateResponse> {
    const idempotencyKey = `payment-${bookingId}-${provider}`;
    return request<PaymentCreateResponse>('/payments/create-link', {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify({ booking_id: bookingId, provider }),
    }, true);
}
