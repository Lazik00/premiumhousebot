export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface AdminUser {
  id: string;
  telegram_id?: number | null;
  first_name: string;
  last_name?: string | null;
  username?: string | null;
  photo_url?: string | null;
  email?: string | null;
  phone?: string | null;
  status: string;
  roles: string[];
  created_at: string;
  last_login_at?: string | null;
}

export interface AdminLoginResponse extends TokenPair {
  user: Omit<AdminUser, 'status' | 'created_at'>;
}

export interface UserMe extends AdminUser {}

export interface StatusCount {
  status: string;
  count: number;
}

export interface RevenuePoint {
  day: string;
  amount: number;
}

export interface DashboardKPIs {
  total_bookings: number;
  active_bookings: number;
  active_listings: number;
  pending_listings: number;
  total_users: number;
  total_hosts: number;
  pending_payments: number;
  gross_revenue: number;
  platform_commission: number;
  host_earnings: number;
}

export interface RecentBooking {
  id: string;
  booking_code: string;
  status: string;
  total_price: number;
  start_date: string;
  end_date: string;
  created_at: string;
  customer_name: string;
  property_title: string;
}

export interface RecentProperty {
  id: string;
  title: string;
  city: string;
  host_name: string;
  property_type: string;
  status: string;
  created_at: string;
  price_per_night: number;
}

export interface AdminDashboard {
  kpis: DashboardKPIs;
  booking_statuses: StatusCount[];
  payment_statuses: StatusCount[];
  revenue_series: RevenuePoint[];
  recent_bookings: RecentBooking[];
  recent_properties: RecentProperty[];
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface AdminUserRow {
  id: string;
  first_name: string;
  last_name?: string | null;
  username?: string | null;
  email?: string | null;
  phone?: string | null;
  telegram_id?: number | null;
  status: string;
  roles: string[];
  total_bookings: number;
  created_at: string;
  last_login_at?: string | null;
}

export interface AdminPropertyImageInput {
  image_url: string;
  object_key?: string | null;
  is_cover: boolean;
  sort_order: number;
}

export interface AdminPropertyImage extends AdminPropertyImageInput {
  id: string;
}

export interface AdminUploadedImage {
  object_key: string;
  image_url: string;
  original_name: string;
  content_type: string;
  size: number;
}

export interface AdminAmenityOption {
  id: string;
  code: string;
  name_uz: string;
  icon?: string | null;
}

export interface AdminHostOption {
  id: string;
  label: string;
  email?: string | null;
  username?: string | null;
}

export interface AdminRegionOption {
  id: string;
  name: string;
}

export interface AdminCityOption {
  id: string;
  region_id: string;
  region_name: string;
  name: string;
}

export interface AdminMetaOptions {
  hosts: AdminHostOption[];
  regions: AdminRegionOption[];
  cities: AdminCityOption[];
  amenities: AdminAmenityOption[];
}

export interface AdminPaymentMethod {
  id: string;
  brand: 'visa' | 'mastercard' | 'humo' | 'uzcard' | string;
  name: string;
  card_holder: string;
  card_number: string;
  instructions?: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface AdminPaymentMethodPayload {
  brand: 'visa' | 'mastercard' | 'humo' | 'uzcard';
  name: string;
  card_holder: string;
  card_number: string;
  instructions?: string | null;
  is_active: boolean;
  sort_order: number;
}

export interface AdminPropertyRow {
  id: string;
  title: string;
  city: string;
  region: string;
  host_name: string;
  property_type: string;
  status: string;
  capacity: number;
  price_per_night: number;
  average_rating: number;
  review_count: number;
  created_at: string;
}

export interface AdminPropertyDetail {
  id: string;
  host_id: string;
  host_name: string;
  title: string;
  description: string;
  address: string;
  region_id: string;
  region: string;
  city_id: string;
  city: string;
  latitude: number;
  longitude: number;
  property_type: string;
  capacity: number;
  rooms: number;
  bathrooms: number;
  total_area_sqm?: number | null;
  floor?: number | null;
  total_floors?: number | null;
  bedrooms?: number | null;
  beds?: number | null;
  price_per_night: number;
  currency: string;
  cancellation_policy?: string | null;
  house_rules?: string | null;
  status: string;
  average_rating: number;
  review_count: number;
  images: AdminPropertyImage[];
  amenities: AdminAmenityOption[];
  created_at: string;
  updated_at: string;
}

export interface AdminPropertyAvailabilityBlock {
  id?: string | null;
  source: 'booking' | 'manual' | string;
  status: string;
  start_date: string;
  end_date: string;
  label?: string | null;
  note?: string | null;
  booking_id?: string | null;
  booking_code?: string | null;
  can_delete: boolean;
  created_at?: string | null;
}

export interface AdminPropertyAvailability {
  property_id: string;
  blocked_ranges: AdminPropertyAvailabilityBlock[];
}

export interface AdminPropertyAvailabilityCreatePayload {
  start_date: string;
  end_date: string;
  note?: string | null;
}

export interface AdminPropertyPayload {
  host_id: string;
  region_id: string;
  city_id: string;
  title: string;
  description: string;
  address: string;
  latitude: number;
  longitude: number;
  property_type: string;
  capacity: number;
  rooms: number;
  bathrooms: number;
  total_area_sqm?: number | null;
  floor?: number | null;
  total_floors?: number | null;
  bedrooms?: number | null;
  beds?: number | null;
  price_per_night: number;
  currency: string;
  cancellation_policy?: string | null;
  house_rules?: string | null;
  status: string;
  amenity_ids: string[];
  images: AdminPropertyImageInput[];
}

export interface AdminBookingRow {
  id: string;
  booking_code: string;
  status: 'pending_payment' | 'awaiting_confirmation' | 'confirmed' | 'cancelled' | 'completed' | 'expired' | string;
  start_date: string;
  end_date: string;
  total_nights: number;
  guests_total: number;
  total_price: number;
  currency: string;
  expires_at?: string | null;
  confirmed_at?: string | null;
  created_at: string;
  customer_name: string;
  property_title: string;
  payment_provider?: string | null;
  payment_status?: string | null;
}

export interface AdminBookingPaymentSummary {
  id: string;
  provider: string;
  status: string;
  amount: number;
  currency: string;
  payment_method_id?: string | null;
  payment_method_brand?: string | null;
  payment_method_name?: string | null;
  payment_method_card_holder?: string | null;
  payment_method_card_number?: string | null;
  customer_note?: string | null;
  payment_url?: string | null;
  provider_payment_id?: string | null;
  created_at: string;
  paid_at?: string | null;
}

export interface AdminBookingEvent {
  id: string;
  event_type: string;
  old_status?: string | null;
  new_status?: string | null;
  event_payload: Record<string, unknown>;
  created_at: string;
}

export interface AdminBookingDetail {
  id: string;
  booking_code: string;
  status: 'pending_payment' | 'awaiting_confirmation' | 'confirmed' | 'cancelled' | 'completed' | 'expired' | string;
  start_date: string;
  end_date: string;
  total_nights: number;
  guests_total: number;
  guests_adults_men: number;
  guests_adults_women: number;
  guests_children: number;
  total_price: number;
  currency: string;
  expires_at?: string | null;
  confirmed_at?: string | null;
  cancelled_at?: string | null;
  cancel_reason?: string | null;
  created_at: string;
  customer: AdminUserRow;
  property: AdminPropertyRow;
  payments: AdminBookingPaymentSummary[];
  events: AdminBookingEvent[];
}

export interface AdminPaymentRow {
  id: string;
  booking_id: string;
  booking_code: string;
  provider: string;
  payment_method_id?: string | null;
  payment_method_brand?: string | null;
  payment_method_name?: string | null;
  payment_method_card_number?: string | null;
  provider_payment_id?: string | null;
  status: string;
  amount: number;
  currency: string;
  payment_url?: string | null;
  customer_name: string;
  property_title: string;
  created_at: string;
  paid_at?: string | null;
}

export interface AdminPaymentCallback {
  id: string;
  provider_event_id: string;
  signature: string;
  is_valid: boolean;
  processed_at?: string | null;
  created_at: string;
  payload: Record<string, unknown>;
}

export interface AdminRefundRow {
  id: string;
  amount: number;
  status: string;
  reason?: string | null;
  provider_refund_id?: string | null;
  processed_at?: string | null;
  created_at: string;
}

export interface AdminPaymentDetail {
  id: string;
  booking_id: string;
  booking_code: string;
  provider: string;
  payment_method_id?: string | null;
  payment_method_brand?: string | null;
  payment_method_name?: string | null;
  payment_method_card_holder?: string | null;
  payment_method_card_number?: string | null;
  provider_payment_id?: string | null;
  status: string;
  amount: number;
  currency: string;
  payment_url?: string | null;
  raw_request: Record<string, unknown>;
  raw_response: Record<string, unknown>;
  customer_name: string;
  customer_email?: string | null;
  property_title: string;
  created_at: string;
  paid_at?: string | null;
  failed_at?: string | null;
  callbacks: AdminPaymentCallback[];
  refunds: AdminRefundRow[];
}

export interface AdminBookingActionResponse {
  booking_id: string;
  payment_id?: string | null;
  booking_status: string;
  payment_status?: string | null;
  confirmed_at?: string | null;
}

export interface AdminRefundResponse {
  refund_id: string;
  payment_id: string;
  booking_id: string;
  provider: string;
  status: string;
  amount: number;
  provider_refund_id?: string | null;
  processed_at?: string | null;
}

export interface AdminHostBalanceRow {
  id?: string | null;
  host_id: string;
  host_name: string;
  email?: string | null;
  currency: string;
  available_amount: number;
  pending_amount: number;
  total_earned_amount: number;
  total_paid_out_amount: number;
  updated_at?: string | null;
}

export interface AdminLedgerEntry {
  id: string;
  direction: string;
  amount: number;
  currency: string;
  description?: string | null;
  reference_type?: string | null;
  reference_id?: string | null;
  created_at: string;
}

export interface AdminHostBalanceDetail {
  host_id: string;
  host_name: string;
  email?: string | null;
  currency: string;
  available_amount: number;
  pending_amount: number;
  total_earned_amount: number;
  total_paid_out_amount: number;
  updated_at?: string | null;
  ledger_entries: AdminLedgerEntry[];
}
