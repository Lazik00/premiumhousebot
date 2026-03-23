-- Premium House - PostgreSQL Production Schema
-- Target: PostgreSQL 15+

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- =========================
-- ENUMS
-- =========================
CREATE TYPE user_status AS ENUM ('active', 'blocked', 'pending_verification');
CREATE TYPE property_status AS ENUM ('draft', 'pending_review', 'active', 'blocked', 'archived');
CREATE TYPE property_type AS ENUM ('apartment', 'house', 'villa', 'guest_house', 'other');
CREATE TYPE cancellation_policy AS ENUM ('flexible', 'moderate', 'strict', 'non_refundable');
CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'cancelled', 'completed');
CREATE TYPE payment_status AS ENUM (
    'initiated',
    'authorized',
    'captured',
    'failed',
    'cancelled',
    'refund_pending',
    'refunded'
);
CREATE TYPE payment_provider AS ENUM ('click', 'payme', 'rahmat');
CREATE TYPE transaction_type AS ENUM ('authorization', 'capture', 'refund', 'commission', 'host_payout');
CREATE TYPE transaction_status AS ENUM ('pending', 'success', 'failed');
CREATE TYPE commission_status AS ENUM ('pending', 'calculated', 'settled', 'reversed');
CREATE TYPE otp_purpose AS ENUM ('register', 'login', 'password_reset', 'phone_verify', 'email_verify');
CREATE TYPE otp_target AS ENUM ('phone', 'email');
CREATE TYPE promo_discount_type AS ENUM ('percent', 'fixed');
CREATE TYPE notification_channel AS ENUM ('email', 'sms', 'telegram');
CREATE TYPE notification_status AS ENUM ('queued', 'sent', 'failed');
CREATE TYPE payout_status AS ENUM ('pending', 'processing', 'paid', 'failed');

-- =========================
-- UTILS
-- =========================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =========================
-- RBAC TABLES
-- =========================
CREATE TABLE roles (
    id SMALLSERIAL PRIMARY KEY,
    code VARCHAR(40) NOT NULL UNIQUE,
    name VARCHAR(80) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE permissions (
    id SERIAL PRIMARY KEY,
    code VARCHAR(80) NOT NULL UNIQUE,
    name VARCHAR(120) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE role_permissions (
    role_id SMALLINT NOT NULL REFERENCES roles(id),
    permission_id INTEGER NOT NULL REFERENCES permissions(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (role_id, permission_id)
);

-- =========================
-- USERS / AUTH
-- =========================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email CITEXT,
    phone VARCHAR(20) NOT NULL,
    password_hash TEXT,
    first_name VARCHAR(80) NOT NULL,
    last_name VARCHAR(80),
    avatar_url TEXT,
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
    status user_status NOT NULL DEFAULT 'pending_verification',
    locale VARCHAR(8) NOT NULL DEFAULT 'uz',
    time_zone VARCHAR(64) NOT NULL DEFAULT 'Asia/Tashkent',
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX ux_users_email_active
    ON users(email)
    WHERE deleted_at IS NULL AND email IS NOT NULL;

CREATE UNIQUE INDEX ux_users_phone_active
    ON users(phone)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_users_status ON users(status) WHERE deleted_at IS NULL;

CREATE TABLE user_roles (
    user_id UUID NOT NULL REFERENCES users(id),
    role_id SMALLINT NOT NULL REFERENCES roles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, role_id)
);

CREATE TABLE otp_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    target_type otp_target NOT NULL,
    target_value VARCHAR(255) NOT NULL,
    purpose otp_purpose NOT NULL,
    otp_hash TEXT NOT NULL,
    attempts SMALLINT NOT NULL DEFAULT 0,
    expires_at TIMESTAMPTZ NOT NULL,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_otp_target_purpose ON otp_verifications(target_type, target_value, purpose)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_otp_expires ON otp_verifications(expires_at) WHERE verified_at IS NULL;

CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    token_hash TEXT NOT NULL UNIQUE,
    user_agent VARCHAR(255),
    ip_address INET,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id)
    WHERE revoked_at IS NULL AND deleted_at IS NULL;

-- =========================
-- LOCATION
-- =========================
CREATE TABLE regions (
    id SERIAL PRIMARY KEY,
    country_code CHAR(2) NOT NULL DEFAULT 'UZ',
    name_uz VARCHAR(120) NOT NULL,
    name_ru VARCHAR(120),
    name_en VARCHAR(120),
    slug VARCHAR(120) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE cities (
    id SERIAL PRIMARY KEY,
    region_id INTEGER NOT NULL REFERENCES regions(id),
    name_uz VARCHAR(120) NOT NULL,
    name_ru VARCHAR(120),
    name_en VARCHAR(120),
    slug VARCHAR(120) NOT NULL,
    latitude NUMERIC(9,6),
    longitude NUMERIC(9,6),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE (region_id, slug)
);

CREATE INDEX idx_cities_region ON cities(region_id) WHERE deleted_at IS NULL;

-- =========================
-- PROPERTY DOMAIN
-- =========================
CREATE TABLE properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    host_id UUID NOT NULL REFERENCES users(id),
    city_id INTEGER NOT NULL REFERENCES cities(id),
    property_type property_type NOT NULL,
    title VARCHAR(180) NOT NULL,
    description TEXT NOT NULL,
    address_line1 VARCHAR(255) NOT NULL,
    address_line2 VARCHAR(255),
    postal_code VARCHAR(32),
    latitude NUMERIC(9,6) NOT NULL,
    longitude NUMERIC(9,6) NOT NULL,
    max_guests SMALLINT NOT NULL CHECK (max_guests > 0),
    bedrooms SMALLINT NOT NULL DEFAULT 1 CHECK (bedrooms >= 0),
    bathrooms SMALLINT NOT NULL DEFAULT 1 CHECK (bathrooms >= 0),
    price_per_night NUMERIC(12,2) NOT NULL CHECK (price_per_night >= 0),
    cleaning_fee NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (cleaning_fee >= 0),
    service_fee NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (service_fee >= 0),
    currency CHAR(3) NOT NULL DEFAULT 'UZS',
    house_rules TEXT,
    cancellation_policy cancellation_policy NOT NULL DEFAULT 'moderate',
    check_in_time TIME NOT NULL DEFAULT TIME '14:00',
    check_out_time TIME NOT NULL DEFAULT TIME '12:00',
    status property_status NOT NULL DEFAULT 'draft',
    average_rating NUMERIC(3,2) NOT NULL DEFAULT 0,
    review_count INTEGER NOT NULL DEFAULT 0,
    search_vector TSVECTOR GENERATED ALWAYS AS (
        to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(description, ''))
    ) STORED,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_properties_host ON properties(host_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_properties_city_status_price ON properties(city_id, status, price_per_night)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_properties_status ON properties(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_properties_search_vector ON properties USING GIN(search_vector);

CREATE TABLE property_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id),
    object_key VARCHAR(255) NOT NULL,
    image_url TEXT NOT NULL,
    sort_order SMALLINT NOT NULL DEFAULT 1,
    is_cover BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_property_images_property ON property_images(property_id) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX ux_property_image_order_active
    ON property_images(property_id, sort_order)
    WHERE deleted_at IS NULL;

CREATE TABLE amenities (
    id SMALLSERIAL PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    name_uz VARCHAR(120) NOT NULL,
    name_ru VARCHAR(120),
    name_en VARCHAR(120),
    icon VARCHAR(120),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE property_amenities (
    property_id UUID NOT NULL REFERENCES properties(id),
    amenity_id SMALLINT NOT NULL REFERENCES amenities(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (property_id, amenity_id)
);

CREATE TABLE property_calendar (
    property_id UUID NOT NULL REFERENCES properties(id),
    calendar_date DATE NOT NULL,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    price_override NUMERIC(12,2),
    minimum_stay SMALLINT NOT NULL DEFAULT 1 CHECK (minimum_stay > 0),
    closed_reason VARCHAR(200),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    PRIMARY KEY (property_id, calendar_date)
);

CREATE INDEX idx_property_calendar_available
    ON property_calendar(property_id, calendar_date, is_available)
    WHERE deleted_at IS NULL;

-- =========================
-- WISHLIST / PROMO
-- =========================
CREATE TABLE wishlists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    name VARCHAR(120) NOT NULL DEFAULT 'Favorites',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX ux_wishlist_user_name_active
    ON wishlists(user_id, lower(name))
    WHERE deleted_at IS NULL;

CREATE TABLE wishlist_items (
    wishlist_id UUID NOT NULL REFERENCES wishlists(id),
    property_id UUID NOT NULL REFERENCES properties(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    PRIMARY KEY (wishlist_id, property_id)
);

CREATE TABLE promo_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    discount_type promo_discount_type NOT NULL,
    discount_value NUMERIC(12,2) NOT NULL CHECK (discount_value > 0),
    max_discount_amount NUMERIC(12,2),
    min_booking_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    usage_limit_total INTEGER,
    usage_limit_per_user INTEGER,
    used_count INTEGER NOT NULL DEFAULT 0,
    valid_from TIMESTAMPTZ NOT NULL,
    valid_to TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CHECK (valid_to > valid_from)
);

CREATE INDEX idx_promo_codes_validity
    ON promo_codes(is_active, valid_from, valid_to)
    WHERE deleted_at IS NULL;

-- =========================
-- BOOKING
-- =========================
CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_ref VARCHAR(30) NOT NULL UNIQUE,
    property_id UUID NOT NULL REFERENCES properties(id),
    customer_id UUID NOT NULL REFERENCES users(id),
    host_id UUID NOT NULL REFERENCES users(id),
    check_in DATE NOT NULL,
    check_out DATE NOT NULL,
    nights INTEGER GENERATED ALWAYS AS (check_out - check_in) STORED,
    guests_count SMALLINT NOT NULL CHECK (guests_count > 0),
    base_amount NUMERIC(12,2) NOT NULL CHECK (base_amount >= 0),
    cleaning_fee NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (cleaning_fee >= 0),
    service_fee NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (service_fee >= 0),
    promo_discount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (promo_discount >= 0),
    total_amount NUMERIC(12,2) NOT NULL CHECK (total_amount >= 0),
    currency CHAR(3) NOT NULL DEFAULT 'UZS',
    status booking_status NOT NULL DEFAULT 'pending',
    cancellation_reason TEXT,
    cancelled_by UUID REFERENCES users(id),
    cancelled_at TIMESTAMPTZ,
    confirmed_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    idempotency_key VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CHECK (check_out > check_in),
    CHECK (total_amount = (base_amount + cleaning_fee + service_fee - promo_discount))
);

CREATE UNIQUE INDEX ux_bookings_idempotency_active
    ON bookings(idempotency_key)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_bookings_property_dates ON bookings(property_id, check_in, check_out)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_bookings_customer_status ON bookings(customer_id, status)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_bookings_host_status ON bookings(host_id, status)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_bookings_status_expires ON bookings(status, expires_at)
    WHERE deleted_at IS NULL;

ALTER TABLE bookings
ADD CONSTRAINT ex_bookings_no_overlap
EXCLUDE USING GIST (
    property_id WITH =,
    daterange(check_in, check_out, '[)') WITH &&
)
WHERE (deleted_at IS NULL AND status IN ('pending', 'confirmed', 'completed'));

CREATE TABLE promo_code_usages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    promo_code_id UUID NOT NULL REFERENCES promo_codes(id),
    booking_id UUID NOT NULL UNIQUE REFERENCES bookings(id),
    user_id UUID NOT NULL REFERENCES users(id),
    discount_amount NUMERIC(12,2) NOT NULL CHECK (discount_amount >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_promo_usage_user_code ON promo_code_usages(user_id, promo_code_id);

CREATE TABLE booking_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id),
    old_status booking_status,
    new_status booking_status,
    event_type VARCHAR(80) NOT NULL,
    actor_user_id UUID REFERENCES users(id),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_booking_events_booking ON booking_events(booking_id, created_at DESC);

-- =========================
-- PAYMENT / TRANSACTIONS / COMMISSIONS
-- =========================
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id),
    provider payment_provider NOT NULL,
    provider_payment_id VARCHAR(120),
    idempotency_key VARCHAR(100) NOT NULL,
    amount_authorized NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (amount_authorized >= 0),
    amount_captured NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (amount_captured >= 0),
    currency CHAR(3) NOT NULL DEFAULT 'UZS',
    status payment_status NOT NULL DEFAULT 'initiated',
    failure_code VARCHAR(80),
    failure_message TEXT,
    payment_method JSONB NOT NULL DEFAULT '{}'::jsonb,
    provider_response JSONB NOT NULL DEFAULT '{}'::jsonb,
    authorized_at TIMESTAMPTZ,
    captured_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    refunded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX ux_payments_provider_payment_id
    ON payments(provider, provider_payment_id)
    WHERE provider_payment_id IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX ux_payments_idempotency
    ON payments(idempotency_key)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_payments_booking ON payments(booking_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_payments_status ON payments(status) WHERE deleted_at IS NULL;

CREATE TABLE payment_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider payment_provider NOT NULL,
    provider_event_id VARCHAR(120) NOT NULL,
    signature VARCHAR(255) NOT NULL,
    payload JSONB NOT NULL,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (provider, provider_event_id)
);

CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES payments(id),
    booking_id UUID NOT NULL REFERENCES bookings(id),
    txn_type transaction_type NOT NULL,
    status transaction_status NOT NULL,
    amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
    currency CHAR(3) NOT NULL DEFAULT 'UZS',
    provider_txn_id VARCHAR(120),
    external_reference VARCHAR(120),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_transactions_booking_type ON transactions(booking_id, txn_type)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_transactions_payment ON transactions(payment_id)
    WHERE deleted_at IS NULL;

CREATE TABLE commissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL UNIQUE REFERENCES bookings(id),
    payment_id UUID REFERENCES payments(id),
    platform_rate NUMERIC(5,2) NOT NULL CHECK (platform_rate >= 0 AND platform_rate <= 100),
    platform_amount NUMERIC(12,2) NOT NULL CHECK (platform_amount >= 0),
    host_amount NUMERIC(12,2) NOT NULL CHECK (host_amount >= 0),
    currency CHAR(3) NOT NULL DEFAULT 'UZS',
    status commission_status NOT NULL DEFAULT 'pending',
    settled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CHECK (platform_amount + host_amount >= 0)
);

CREATE INDEX idx_commissions_status ON commissions(status) WHERE deleted_at IS NULL;

CREATE TABLE host_payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    host_id UUID NOT NULL REFERENCES users(id),
    booking_id UUID NOT NULL UNIQUE REFERENCES bookings(id),
    amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
    currency CHAR(3) NOT NULL DEFAULT 'UZS',
    status payout_status NOT NULL DEFAULT 'pending',
    scheduled_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    provider_reference VARCHAR(120),
    failure_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_host_payouts_host_status ON host_payouts(host_id, status)
    WHERE deleted_at IS NULL;

-- =========================
-- REVIEWS
-- =========================
CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL UNIQUE REFERENCES bookings(id),
    property_id UUID NOT NULL REFERENCES properties(id),
    customer_id UUID NOT NULL REFERENCES users(id),
    rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    host_reply TEXT,
    host_replied_at TIMESTAMPTZ,
    is_visible BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_reviews_property ON reviews(property_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_reviews_customer ON reviews(customer_id) WHERE deleted_at IS NULL;

-- =========================
-- NOTIFICATIONS / AUDIT
-- =========================
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    channel notification_channel NOT NULL,
    template_code VARCHAR(80) NOT NULL,
    recipient VARCHAR(255) NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status notification_status NOT NULL DEFAULT 'queued',
    failure_reason TEXT,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_notifications_user_status ON notifications(user_id, status)
    WHERE deleted_at IS NULL;

CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,
    actor_user_id UUID REFERENCES users(id),
    action VARCHAR(120) NOT NULL,
    entity_type VARCHAR(80) NOT NULL,
    entity_id UUID,
    ip_address INET,
    user_agent VARCHAR(255),
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_actor_created ON audit_logs(actor_user_id, created_at DESC);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id, created_at DESC);

-- =========================
-- TRIGGERS
-- =========================
CREATE TRIGGER trg_roles_updated_at BEFORE UPDATE ON roles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_permissions_updated_at BEFORE UPDATE ON permissions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_otp_updated_at BEFORE UPDATE ON otp_verifications FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_refresh_tokens_updated_at BEFORE UPDATE ON refresh_tokens FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_regions_updated_at BEFORE UPDATE ON regions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_cities_updated_at BEFORE UPDATE ON cities FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_properties_updated_at BEFORE UPDATE ON properties FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_property_images_updated_at BEFORE UPDATE ON property_images FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_amenities_updated_at BEFORE UPDATE ON amenities FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_property_calendar_updated_at BEFORE UPDATE ON property_calendar FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_wishlists_updated_at BEFORE UPDATE ON wishlists FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_promo_codes_updated_at BEFORE UPDATE ON promo_codes FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_bookings_updated_at BEFORE UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_payments_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_transactions_updated_at BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_commissions_updated_at BEFORE UPDATE ON commissions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_host_payouts_updated_at BEFORE UPDATE ON host_payouts FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_reviews_updated_at BEFORE UPDATE ON reviews FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_notifications_updated_at BEFORE UPDATE ON notifications FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =========================
-- RBAC BASE SEED
-- =========================
INSERT INTO roles (code, name)
VALUES
    ('super_admin', 'Super Admin'),
    ('admin', 'Admin'),
    ('host', 'Host'),
    ('customer', 'Customer')
ON CONFLICT (code) DO NOTHING;

INSERT INTO permissions (code, name, description)
VALUES
    ('user.block', 'Block user', 'Block or unblock platform users'),
    ('listing.moderate', 'Moderate listing', 'Approve/reject or block property listing'),
    ('booking.manage', 'Manage booking', 'View and manage all bookings'),
    ('commission.view', 'View commission', 'View platform commission data'),
    ('property.create', 'Create property', 'Create own listing'),
    ('property.update.own', 'Update own property', 'Update own listing'),
    ('booking.create', 'Create booking', 'Create reservation on property'),
    ('review.create', 'Create review', 'Leave review after completed booking')
ON CONFLICT (code) DO NOTHING;

COMMIT;
