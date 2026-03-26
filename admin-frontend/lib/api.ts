import type {
  AdminBookingDetail,
  AdminBookingRow,
  AdminDashboard,
  AdminHostBalanceDetail,
  AdminHostBalanceRow,
  AdminLoginResponse,
  AdminMetaOptions,
  AdminPaymentDetail,
  AdminPaymentRow,
  AdminPropertyDetail,
  AdminPropertyPayload,
  AdminPropertyRow,
  AdminRefundResponse,
  AdminUploadedImage,
  AdminUserRow,
  PaginatedResponse,
  UserMe,
} from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE || '/api/v1';

let accessToken: string | null = null;
let refreshToken: string | null = null;

export function loadTokens() {
  if (typeof window === 'undefined') return;
  accessToken = localStorage.getItem('ph_admin_access_token');
  refreshToken = localStorage.getItem('ph_admin_refresh_token');
}

export function getAccessToken() {
  return accessToken;
}

export function hasRefreshToken() {
  return !!refreshToken;
}

export function setTokens(access: string, refresh: string) {
  accessToken = access;
  refreshToken = refresh;
  if (typeof window !== 'undefined') {
    localStorage.setItem('ph_admin_access_token', access);
    localStorage.setItem('ph_admin_refresh_token', refresh);
  }
}

export function clearTokens() {
  accessToken = null;
  refreshToken = null;
  if (typeof window !== 'undefined') {
    localStorage.removeItem('ph_admin_access_token');
    localStorage.removeItem('ph_admin_refresh_token');
  }
}

async function parseError(response: Response): Promise<string> {
  try {
    const payload = await response.json();
    if (typeof payload?.detail === 'string') return payload.detail;
    return JSON.stringify(payload);
  } catch {
    return await response.text();
  }
}

async function request<T>(path: string, options: RequestInit = {}, requireAuth = true): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (requireAuth && accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  const execute = async () => fetch(`${API_BASE}${path}`, { ...options, headers, cache: 'no-store' });
  let response = await execute();

  if (response.status === 401 && requireAuth && refreshToken) {
    const refreshed = await refreshAdminToken();
    if (refreshed) {
      headers.set('Authorization', `Bearer ${accessToken}`);
      response = await execute();
    }
  }

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

async function refreshAdminToken(): Promise<boolean> {
  if (!refreshToken) return false;
  try {
    const response = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!response.ok) return false;
    const data = await response.json();
    setTokens(data.access_token, data.refresh_token);
    return true;
  } catch {
    return false;
  }
}

export async function refreshStoredSession(): Promise<boolean> {
  return refreshAdminToken();
}

function queryString(params: Record<string, string | number | undefined | null>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  });
  const query = search.toString();
  return query ? `?${query}` : '';
}

function createIdempotencyKey() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `admin-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function adminLogin(email: string, password: string): Promise<AdminLoginResponse> {
  const data = await request<AdminLoginResponse>(
    '/auth/admin/login',
    {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    },
    false,
  );
  setTokens(data.access_token, data.refresh_token);
  return data;
}

export async function getMe(): Promise<UserMe> {
  return request<UserMe>('/auth/me');
}

export async function logout(): Promise<void> {
  if (refreshToken) {
    await request('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
    }).catch(() => undefined);
  }
  clearTokens();
}

export async function getDashboard(): Promise<AdminDashboard> {
  return request<AdminDashboard>('/admin/dashboard');
}

export async function getMetaOptions(): Promise<AdminMetaOptions> {
  return request<AdminMetaOptions>('/admin/meta/options');
}

export async function listUsers(params: { search?: string; status?: string; limit?: number; offset?: number } = {}): Promise<PaginatedResponse<AdminUserRow>> {
  return request<PaginatedResponse<AdminUserRow>>(`/admin/users${queryString(params)}`);
}

export async function updateUserStatus(userId: string, status: string): Promise<{ id: string; status: string }> {
  return request(`/admin/users/${userId}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  });
}

export async function listProperties(params: { search?: string; status?: string; property_type?: string; region_id?: string; city_id?: string; limit?: number; offset?: number } = {}): Promise<PaginatedResponse<AdminPropertyRow>> {
  return request<PaginatedResponse<AdminPropertyRow>>(`/admin/properties${queryString(params)}`);
}

export async function getProperty(propertyId: string): Promise<AdminPropertyDetail> {
  return request<AdminPropertyDetail>(`/admin/properties/${propertyId}`);
}

export async function createProperty(payload: AdminPropertyPayload): Promise<AdminPropertyDetail> {
  return request<AdminPropertyDetail>('/admin/properties', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function uploadPropertyImage(file: File): Promise<AdminUploadedImage> {
  const formData = new FormData();
  formData.append('file', file);
  return request<AdminUploadedImage>('/admin/property-images/upload', {
    method: 'POST',
    body: formData,
  });
}

export async function updateProperty(propertyId: string, payload: AdminPropertyPayload): Promise<AdminPropertyDetail> {
  return request<AdminPropertyDetail>(`/admin/properties/${propertyId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function updatePropertyStatus(propertyId: string, status: string): Promise<{ id: string; status: string }> {
  return request(`/admin/properties/${propertyId}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  });
}

export async function listBookings(params: { search?: string; status?: string; limit?: number; offset?: number } = {}): Promise<PaginatedResponse<AdminBookingRow>> {
  return request<PaginatedResponse<AdminBookingRow>>(`/admin/bookings${queryString(params)}`);
}

export async function getBooking(bookingId: string): Promise<AdminBookingDetail> {
  return request<AdminBookingDetail>(`/admin/bookings/${bookingId}`);
}

export async function listPayments(params: { search?: string; status?: string; provider?: string; limit?: number; offset?: number } = {}): Promise<PaginatedResponse<AdminPaymentRow>> {
  return request<PaginatedResponse<AdminPaymentRow>>(`/admin/payments${queryString(params)}`);
}

export async function getPayment(paymentId: string): Promise<AdminPaymentDetail> {
  return request<AdminPaymentDetail>(`/admin/payments/${paymentId}`);
}

export async function refundPayment(paymentId: string, payload: { amount?: number; reason?: string | null }): Promise<AdminRefundResponse> {
  return request<AdminRefundResponse>(`/payments/${paymentId}/refund`, {
    method: 'POST',
    headers: { 'Idempotency-Key': createIdempotencyKey() },
    body: JSON.stringify(payload),
  });
}

export async function listHostBalances(params: { search?: string; limit?: number; offset?: number } = {}): Promise<PaginatedResponse<AdminHostBalanceRow>> {
  return request<PaginatedResponse<AdminHostBalanceRow>>(`/admin/host-balances${queryString(params)}`);
}

export async function getHostBalance(hostId: string): Promise<AdminHostBalanceDetail> {
  return request<AdminHostBalanceDetail>(`/admin/host-balances/${hostId}`);
}
