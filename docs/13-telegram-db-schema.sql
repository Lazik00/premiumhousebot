-- Premium House Telegram Mini App Production Schema
-- PostgreSQL 15+

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- =========================
-- ENUMS
-- =========================
CREATE TYPE user_status AS ENUM ('active', 'blocked', 'pending');
CREATE TYPE property_status AS ENUM ('draft', 'pending_review', 'active', 'blocked', 'archived');
CREATE TYPE property_type AS ENUM ('apartment', 'house', 'villa');
CREATE TYPE booking_status AS ENUM ('pending_payment', 'confirmed', 'cancelled', 'completed', 'expired');
CREATE TYPE payment_provider AS ENUM ('rahmat', 'click', 'payme');
CREATE TYPE payment_status AS ENUM ('initiated', 'pending', 'success', 'failed', 'cancelled', 'refunded', 'partial_refunded');
CREATE TYPE transaction_type AS ENUM ('payment_in', 'commission', 'host_earning', 'refund_out', 'host_payout');
CREATE TYPE refund_status AS ENUM ('pending', 'success', 'failed', 'partial');
CREATE TYPE notification_channel AS ENUM ('telegram', 'sms');
CREATE TYPE notification_status AS ENUM ('queued', 'sent', 'failed');
CREATE TYPE ledger_direction AS ENUM ('debit', 'credit');
CREATE TYPE ledger_account_type AS ENUM ('platform', 'host');

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
-- RBAC
-- =========================
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(40) NOT NULL UNIQUE,
    name VARCHAR(80) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(80) NOT NULL UNIQUE,
    name VARCHAR(120) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID NOT NULL REFERENCES roles(id),
    permission_id UUID NOT NULL REFERENCES permissions(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE (role_id, permission_id)
);

-- =========================
-- USERS / TELEGRAM AUTH
-- =========================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_id BIGINT NOT NULL UNIQUE,
    first_name VARCHAR(120) NOT NULL,
    last_name VARCHAR(120),
    username VARCHAR(120),
    photo_url TEXT,
    phone VARCHAR(20),
    email CITEXT,
    status user_status NOT NULL DEFAULT 'active',
    language_code VARCHAR(10) NOT NULL DEFAULT 'uz',
    time_zone VARCHAR(64) NOT NULL DEFAULT 'Asia/Tashkent',
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX ux_users_phone_active ON users(phone) WHERE phone IS NOT NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX ux_users_email_active ON users(email) WHERE email IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_users_username ON users(username) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_status ON users(status) WHERE deleted_at IS NULL;

CREATE TABLE user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    role_id UUID NOT NULL REFERENCES roles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE (user_id, role_id)
);

CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    token_hash VARCHAR(128) NOT NULL UNIQUE,
    token_family UUID NOT NULL,
    user_agent VARCHAR(255),
    ip_address INET,
    expires_at TIMESTAMPTZ NOT NULL,
    replaced_by_token_hash VARCHAR(128),
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_refresh_tokens_user_active
    ON refresh_tokens(user_id, expires_at)
    WHERE revoked_at IS NULL AND deleted_at IS NULL;

CREATE TABLE auth_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    telegram_id BIGINT,
    event_type VARCHAR(80) NOT NULL,
    ip_address INET,
    user_agent VARCHAR(255),
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- =========================
-- LOCATION
-- =========================
CREATE TABLE regions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name_uz VARCHAR(120) NOT NULL,
    name_ru VARCHAR(120),
    name_en VARCHAR(120),
    slug VARCHAR(120) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE cities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    region_id UUID NOT NULL REFERENCES regions(id),
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
    region_id UUID NOT NULL REFERENCES regions(id),
    city_id UUID NOT NULL REFERENCES cities(id),
    title VARCHAR(180) NOT NULL,
    description TEXT NOT NULL,
    address TEXT NOT NULL,
    latitude NUMERIC(9,6) NOT NULL,
    longitude NUMERIC(9,6) NOT NULL,
    property_type property_type NOT NULL,
    capacity SMALLINT NOT NULL CHECK (capacity > 0),
    rooms SMALLINT NOT NULL CHECK (rooms >= 0),
    bathrooms SMALLINT NOT NULL CHECK (bathrooms >= 0),
    price_per_night NUMERIC(14,2) NOT NULL CHECK (price_per_night >= 0),
    currency CHAR(3) NOT NULL DEFAULT 'UZS',
    cleaning_fee NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (cleaning_fee >= 0),
    service_fee NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (service_fee >= 0),
    cancellation_policy TEXT,
    house_rules TEXT,
    average_rating NUMERIC(3,2) NOT NULL DEFAULT 0,
    review_count INTEGER NOT NULL DEFAULT 0,
    status property_status NOT NULL DEFAULT 'draft',
    search_vector TSVECTOR GENERATED ALWAYS AS (
        to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(description, ''))
    ) STORED,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_properties_city ON properties(city_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_properties_price ON properties(price_per_night) WHERE deleted_at IS NULL;
CREATE INDEX idx_properties_rating ON properties(average_rating DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_properties_status ON properties(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_properties_search ON properties USING GIN(search_vector);

CREATE TABLE property_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id),
    object_key VARCHAR(255) NOT NULL,
    image_url TEXT NOT NULL,
    is_cover BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order SMALLINT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE (property_id, sort_order)
);

CREATE TABLE amenities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(60) NOT NULL UNIQUE,
    name_uz VARCHAR(120) NOT NULL,
    name_ru VARCHAR(120),
    name_en VARCHAR(120),
    icon VARCHAR(120),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE property_amenities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id),
    amenity_id UUID NOT NULL REFERENCES amenities(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE (property_id, amenity_id)
);

CREATE TABLE property_blocked_dates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id),
    blocked_date DATE NOT NULL,
    reason VARCHAR(120),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE (property_id, blocked_date)
);

CREATE INDEX idx_blocked_dates_property_date ON property_blocked_dates(property_id, blocked_date)
    WHERE deleted_at IS NULL;

CREATE TABLE property_dynamic_prices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id),
    target_date DATE NOT NULL,
    price_override NUMERIC(14,2) NOT NULL CHECK (price_override >= 0),
    min_nights SMALLINT NOT NULL DEFAULT 1 CHECK (min_nights > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE (property_id, target_date)
);

CREATE INDEX idx_dynamic_prices_property_date ON property_dynamic_prices(property_id, target_date)
    WHERE deleted_at IS NULL;

-- =========================
-- BOOKING DOMAIN
-- =========================
CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_code VARCHAR(40) NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES users(id),
    property_id UUID NOT NULL REFERENCES properties(id),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_nights INTEGER GENERATED ALWAYS AS (end_date - start_date) STORED,
    price_per_night_snapshot NUMERIC(14,2) NOT NULL CHECK (price_per_night_snapshot >= 0),
    cleaning_fee_snapshot NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (cleaning_fee_snapshot >= 0),
    service_fee_snapshot NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (service_fee_snapshot >= 0),
    platform_commission_snapshot NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (platform_commission_snapshot >= 0),
    host_earning_snapshot NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (host_earning_snapshot >= 0),
    total_price NUMERIC(14,2) NOT NULL CHECK (total_price >= 0),
    commission_percent_snapshot NUMERIC(5,2) NOT NULL CHECK (commission_percent_snapshot >= 0 AND commission_percent_snapshot <= 100),
    status booking_status NOT NULL DEFAULT 'pending_payment',
    idempotency_key VARCHAR(120) NOT NULL,
    expires_at TIMESTAMPTZ,
    confirmed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    cancel_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CHECK (end_date > start_date),
    CHECK (total_price >= (cleaning_fee_snapshot + service_fee_snapshot)),
    CHECK (host_earning_snapshot + platform_commission_snapshot <= total_price)
);

CREATE UNIQUE INDEX ux_bookings_idempotency_active ON bookings(idempotency_key)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_bookings_property_dates ON bookings(property_id, start_date, end_date)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_bookings_user_status ON bookings(user_id, status)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_bookings_status_expiry ON bookings(status, expires_at)
    WHERE deleted_at IS NULL;

ALTER TABLE bookings
ADD CONSTRAINT ex_bookings_no_overlap
EXCLUDE USING GIST (
    property_id WITH =,
    daterange(start_date, end_date, '[)') WITH &&
)
WHERE (deleted_at IS NULL AND status IN ('pending_payment', 'confirmed', 'completed'));

CREATE TABLE booking_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id),
    old_status booking_status,
    new_status booking_status,
    event_type VARCHAR(80) NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_booking_events_booking ON booking_events(booking_id, created_at DESC)
    WHERE deleted_at IS NULL;

-- =========================
-- PAYMENT DOMAIN
-- =========================
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id),
    provider payment_provider NOT NULL,
    provider_payment_id VARCHAR(120),
    payment_url TEXT,
    amount NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
    currency CHAR(3) NOT NULL DEFAULT 'UZS',
    status payment_status NOT NULL DEFAULT 'initiated',
    idempotency_key VARCHAR(120) NOT NULL,
    raw_request JSONB NOT NULL DEFAULT '{}'::jsonb,
    raw_response JSONB NOT NULL DEFAULT '{}'::jsonb,
    paid_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE (provider, provider_payment_id)
);

CREATE UNIQUE INDEX ux_payments_idempotency_active ON payments(idempotency_key)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_payments_booking ON payments(booking_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_payments_status ON payments(status) WHERE deleted_at IS NULL;

CREATE TABLE payment_callbacks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID REFERENCES payments(id),
    provider payment_provider NOT NULL,
    provider_event_id VARCHAR(120) NOT NULL,
    signature VARCHAR(255) NOT NULL,
    payload JSONB NOT NULL,
    is_valid BOOLEAN NOT NULL DEFAULT FALSE,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE (provider, provider_event_id)
);

CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id),
    payment_id UUID REFERENCES payments(id),
    txn_type transaction_type NOT NULL,
    amount NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
    currency CHAR(3) NOT NULL DEFAULT 'UZS',
    provider_reference VARCHAR(120),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_transactions_booking_type ON transactions(booking_id, txn_type)
    WHERE deleted_at IS NULL;

CREATE TABLE refunds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id),
    payment_id UUID NOT NULL REFERENCES payments(id),
    provider payment_provider NOT NULL,
    amount NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
    status refund_status NOT NULL DEFAULT 'pending',
    reason TEXT,
    provider_refund_id VARCHAR(120),
    idempotency_key VARCHAR(120) NOT NULL,
    requested_by UUID REFERENCES users(id),
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE (idempotency_key)
);

CREATE INDEX idx_refunds_payment ON refunds(payment_id) WHERE deleted_at IS NULL;

-- =========================
-- COMMISSION / BALANCES
-- =========================
CREATE TABLE commission_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(120) NOT NULL,
    percent NUMERIC(5,2) NOT NULL CHECK (percent >= 0 AND percent <= 100),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    valid_from TIMESTAMPTZ NOT NULL,
    valid_to TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_commission_policy_active ON commission_policies(is_active, valid_from)
    WHERE deleted_at IS NULL;

CREATE TABLE platform_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    currency CHAR(3) NOT NULL,
    available_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
    pending_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
    last_reconciled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE (currency)
);

CREATE TABLE host_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    host_id UUID NOT NULL REFERENCES users(id),
    currency CHAR(3) NOT NULL,
    available_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
    pending_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
    total_earned_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
    total_paid_out_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
    last_reconciled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE (host_id, currency)
);

CREATE TABLE balance_ledger_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_type ledger_account_type NOT NULL,
    account_id UUID NOT NULL,
    booking_id UUID REFERENCES bookings(id),
    payment_id UUID REFERENCES payments(id),
    transaction_id UUID REFERENCES transactions(id),
    direction ledger_direction NOT NULL,
    amount NUMERIC(18,2) NOT NULL CHECK (amount >= 0),
    currency CHAR(3) NOT NULL,
    description TEXT,
    reference_type VARCHAR(80),
    reference_id VARCHAR(120),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_ledger_account ON balance_ledger_entries(account_type, account_id, created_at)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_ledger_booking ON balance_ledger_entries(booking_id, created_at)
    WHERE deleted_at IS NULL;

-- =========================
-- REVIEWS
-- =========================
CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL UNIQUE REFERENCES bookings(id),
    property_id UUID NOT NULL REFERENCES properties(id),
    user_id UUID NOT NULL REFERENCES users(id),
    rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    host_reply TEXT,
    host_replied_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_reviews_property ON reviews(property_id) WHERE deleted_at IS NULL;

-- =========================
-- NOTIFICATIONS / AUDIT
-- =========================
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    channel notification_channel NOT NULL,
    event_type VARCHAR(80) NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status notification_status NOT NULL DEFAULT 'queued',
    error_message TEXT,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_notifications_user_status ON notifications(user_id, status)
    WHERE deleted_at IS NULL;

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id UUID REFERENCES users(id),
    action VARCHAR(120) NOT NULL,
    entity_type VARCHAR(80) NOT NULL,
    entity_id UUID,
    ip_address INET,
    user_agent VARCHAR(255),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id, created_at DESC)
    WHERE deleted_at IS NULL;

-- =========================
-- TRIGGERS
-- =========================
CREATE TRIGGER trg_roles_updated_at BEFORE UPDATE ON roles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_permissions_updated_at BEFORE UPDATE ON permissions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_role_permissions_updated_at BEFORE UPDATE ON role_permissions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_user_roles_updated_at BEFORE UPDATE ON user_roles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_refresh_tokens_updated_at BEFORE UPDATE ON refresh_tokens FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_auth_audit_logs_updated_at BEFORE UPDATE ON auth_audit_logs FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_regions_updated_at BEFORE UPDATE ON regions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_cities_updated_at BEFORE UPDATE ON cities FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_properties_updated_at BEFORE UPDATE ON properties FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_property_images_updated_at BEFORE UPDATE ON property_images FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_amenities_updated_at BEFORE UPDATE ON amenities FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_property_amenities_updated_at BEFORE UPDATE ON property_amenities FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_blocked_dates_updated_at BEFORE UPDATE ON property_blocked_dates FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_dynamic_prices_updated_at BEFORE UPDATE ON property_dynamic_prices FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_bookings_updated_at BEFORE UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_booking_events_updated_at BEFORE UPDATE ON booking_events FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_payments_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_payment_callbacks_updated_at BEFORE UPDATE ON payment_callbacks FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_transactions_updated_at BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_refunds_updated_at BEFORE UPDATE ON refunds FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_commission_policies_updated_at BEFORE UPDATE ON commission_policies FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_platform_balances_updated_at BEFORE UPDATE ON platform_balances FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_host_balances_updated_at BEFORE UPDATE ON host_balances FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_balance_ledger_entries_updated_at BEFORE UPDATE ON balance_ledger_entries FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_reviews_updated_at BEFORE UPDATE ON reviews FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_notifications_updated_at BEFORE UPDATE ON notifications FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_audit_logs_updated_at BEFORE UPDATE ON audit_logs FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =========================
-- RBAC BASE SEED
-- =========================
INSERT INTO roles (code, name)
VALUES
    ('super_admin', 'SuperAdmin'),
    ('admin', 'Admin'),
    ('host', 'Host'),
    ('customer', 'Customer')
ON CONFLICT (code) DO NOTHING;

COMMIT;
