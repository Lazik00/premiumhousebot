"""init core telegram booking payment

Revision ID: 20260303_0001
Revises:
Create Date: 2026-03-03 23:20:00
"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '20260303_0001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE EXTENSION IF NOT EXISTS pgcrypto;
        CREATE EXTENSION IF NOT EXISTS btree_gist;

        CREATE TYPE user_status AS ENUM ('active', 'blocked', 'pending');
        CREATE TYPE property_status AS ENUM ('draft', 'pending_review', 'active', 'blocked', 'archived');
        CREATE TYPE property_type AS ENUM ('apartment', 'house', 'villa');
        CREATE TYPE booking_status AS ENUM ('pending_payment', 'confirmed', 'cancelled', 'completed', 'expired');
        CREATE TYPE payment_provider AS ENUM ('rahmat', 'click', 'payme');
        CREATE TYPE payment_status AS ENUM ('initiated', 'pending', 'success', 'failed', 'cancelled', 'refunded', 'partial_refunded');
        CREATE TYPE transaction_type AS ENUM ('payment_in', 'commission', 'host_earning', 'refund_out', 'host_payout');
        CREATE TYPE refund_status AS ENUM ('pending', 'success', 'failed', 'partial');
        CREATE TYPE account_type AS ENUM ('platform', 'host');
        CREATE TYPE ledger_direction AS ENUM ('debit', 'credit');

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
            CONSTRAINT uq_role_permission UNIQUE(role_id, permission_id)
        );

        CREATE TABLE users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            telegram_id BIGINT NOT NULL UNIQUE,
            first_name VARCHAR(120) NOT NULL,
            last_name VARCHAR(120),
            username VARCHAR(120),
            photo_url TEXT,
            phone VARCHAR(20),
            email VARCHAR(255),
            status user_status NOT NULL DEFAULT 'active',
            language_code VARCHAR(10) NOT NULL DEFAULT 'uz',
            time_zone VARCHAR(64) NOT NULL DEFAULT 'Asia/Tashkent',
            last_login_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            deleted_at TIMESTAMPTZ
        );

        CREATE INDEX idx_users_status ON users(status) WHERE deleted_at IS NULL;

        CREATE TABLE user_roles (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id),
            role_id UUID NOT NULL REFERENCES roles(id),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            deleted_at TIMESTAMPTZ,
            CONSTRAINT uq_user_role UNIQUE(user_id, role_id)
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

        CREATE INDEX idx_refresh_tokens_user_active ON refresh_tokens(user_id, expires_at)
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
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            deleted_at TIMESTAMPTZ,
            CONSTRAINT uq_city_region_slug UNIQUE(region_id, slug)
        );

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
            capacity SMALLINT NOT NULL,
            rooms SMALLINT NOT NULL,
            bathrooms SMALLINT NOT NULL,
            price_per_night NUMERIC(14,2) NOT NULL,
            currency VARCHAR(3) NOT NULL DEFAULT 'UZS',
            cleaning_fee NUMERIC(14,2) NOT NULL DEFAULT 0,
            service_fee NUMERIC(14,2) NOT NULL DEFAULT 0,
            cancellation_policy TEXT,
            house_rules TEXT,
            average_rating NUMERIC(3,2) NOT NULL DEFAULT 0,
            review_count INTEGER NOT NULL DEFAULT 0,
            status property_status NOT NULL DEFAULT 'draft',
            search_vector tsvector,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            deleted_at TIMESTAMPTZ
        );

        CREATE INDEX idx_properties_city ON properties(city_id);
        CREATE INDEX idx_properties_price ON properties(price_per_night);
        CREATE INDEX idx_properties_rating ON properties(average_rating);
        CREATE INDEX idx_properties_status ON properties(status);
        CREATE INDEX idx_properties_search ON properties USING GIN(search_vector);

        CREATE TABLE bookings (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            booking_code VARCHAR(40) NOT NULL UNIQUE,
            user_id UUID NOT NULL REFERENCES users(id),
            property_id UUID NOT NULL REFERENCES properties(id),
            start_date DATE NOT NULL,
            end_date DATE NOT NULL,
            total_nights INTEGER NOT NULL,
            price_per_night_snapshot NUMERIC(14,2) NOT NULL,
            cleaning_fee_snapshot NUMERIC(14,2) NOT NULL DEFAULT 0,
            service_fee_snapshot NUMERIC(14,2) NOT NULL DEFAULT 0,
            platform_commission_snapshot NUMERIC(14,2) NOT NULL DEFAULT 0,
            host_earning_snapshot NUMERIC(14,2) NOT NULL DEFAULT 0,
            total_price NUMERIC(14,2) NOT NULL,
            commission_percent_snapshot NUMERIC(5,2) NOT NULL,
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
            CONSTRAINT uq_booking_user_idempotency UNIQUE(user_id, idempotency_key),
            CHECK (end_date > start_date)
        );

        CREATE INDEX idx_bookings_property_dates ON bookings(property_id, start_date, end_date);
        CREATE INDEX idx_bookings_user_status ON bookings(user_id, status);
        CREATE INDEX idx_bookings_status_expiry ON bookings(status, expires_at);

        ALTER TABLE bookings
        ADD CONSTRAINT ex_bookings_no_overlap
        EXCLUDE USING gist (
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

        CREATE TABLE payments (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            booking_id UUID NOT NULL REFERENCES bookings(id),
            provider payment_provider NOT NULL,
            provider_payment_id VARCHAR(120),
            payment_url TEXT,
            amount NUMERIC(14,2) NOT NULL,
            currency VARCHAR(3) NOT NULL DEFAULT 'UZS',
            status payment_status NOT NULL DEFAULT 'initiated',
            idempotency_key VARCHAR(120) NOT NULL,
            raw_request JSONB NOT NULL DEFAULT '{}'::jsonb,
            raw_response JSONB NOT NULL DEFAULT '{}'::jsonb,
            paid_at TIMESTAMPTZ,
            failed_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            deleted_at TIMESTAMPTZ,
            CONSTRAINT uq_provider_payment_id UNIQUE(provider, provider_payment_id),
            CONSTRAINT uq_payment_idempotency_key UNIQUE(idempotency_key)
        );

        CREATE INDEX idx_payments_booking ON payments(booking_id);
        CREATE INDEX idx_payments_status ON payments(status);

        CREATE TABLE payment_callbacks (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            payment_id UUID REFERENCES payments(id),
            provider payment_provider NOT NULL,
            provider_event_id VARCHAR(120) NOT NULL,
            signature VARCHAR(255) NOT NULL,
            payload JSONB NOT NULL DEFAULT '{}'::jsonb,
            is_valid BOOLEAN NOT NULL DEFAULT FALSE,
            processed_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            deleted_at TIMESTAMPTZ,
            CONSTRAINT uq_callback_provider_event UNIQUE(provider, provider_event_id)
        );

        CREATE TABLE transactions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            booking_id UUID NOT NULL REFERENCES bookings(id),
            payment_id UUID REFERENCES payments(id),
            txn_type transaction_type NOT NULL,
            amount NUMERIC(14,2) NOT NULL,
            currency VARCHAR(3) NOT NULL DEFAULT 'UZS',
            provider_reference VARCHAR(120),
            metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            deleted_at TIMESTAMPTZ
        );

        CREATE INDEX idx_transactions_booking_type ON transactions(booking_id, txn_type);

        CREATE TABLE refunds (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            booking_id UUID NOT NULL REFERENCES bookings(id),
            payment_id UUID NOT NULL REFERENCES payments(id),
            provider payment_provider NOT NULL,
            amount NUMERIC(14,2) NOT NULL,
            status refund_status NOT NULL,
            reason TEXT,
            provider_refund_id VARCHAR(120),
            idempotency_key VARCHAR(120) NOT NULL UNIQUE,
            requested_by UUID REFERENCES users(id),
            processed_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            deleted_at TIMESTAMPTZ
        );

        CREATE TABLE platform_balances (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            currency VARCHAR(3) NOT NULL UNIQUE,
            available_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
            pending_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            deleted_at TIMESTAMPTZ
        );

        CREATE TABLE host_balances (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            host_id UUID NOT NULL REFERENCES users(id),
            currency VARCHAR(3) NOT NULL,
            available_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
            pending_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
            total_earned_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
            total_paid_out_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            deleted_at TIMESTAMPTZ,
            CONSTRAINT uq_host_balance_currency UNIQUE(host_id, currency)
        );

        CREATE TABLE balance_ledger_entries (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            account_type account_type NOT NULL,
            account_id UUID NOT NULL,
            booking_id UUID REFERENCES bookings(id),
            payment_id UUID REFERENCES payments(id),
            transaction_id UUID REFERENCES transactions(id),
            direction ledger_direction NOT NULL,
            amount NUMERIC(18,2) NOT NULL,
            currency VARCHAR(3) NOT NULL,
            description TEXT,
            reference_type VARCHAR(80),
            reference_id VARCHAR(120),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            deleted_at TIMESTAMPTZ
        );

        CREATE INDEX idx_ledger_account ON balance_ledger_entries(account_type, account_id, created_at);
        CREATE INDEX idx_ledger_booking ON balance_ledger_entries(booking_id, created_at);

        INSERT INTO roles (code, name)
        VALUES
            ('super_admin', 'SuperAdmin'),
            ('admin', 'Admin'),
            ('host', 'Host'),
            ('customer', 'Customer')
        ON CONFLICT (code) DO NOTHING;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DROP TABLE IF EXISTS balance_ledger_entries;
        DROP TABLE IF EXISTS host_balances;
        DROP TABLE IF EXISTS platform_balances;
        DROP TABLE IF EXISTS refunds;
        DROP TABLE IF EXISTS transactions;
        DROP TABLE IF EXISTS payment_callbacks;
        DROP TABLE IF EXISTS payments;
        DROP TABLE IF EXISTS booking_events;
        DROP TABLE IF EXISTS bookings;
        DROP TABLE IF EXISTS properties;
        DROP TABLE IF EXISTS cities;
        DROP TABLE IF EXISTS regions;
        DROP TABLE IF EXISTS auth_audit_logs;
        DROP TABLE IF EXISTS refresh_tokens;
        DROP TABLE IF EXISTS user_roles;
        DROP TABLE IF EXISTS users;
        DROP TABLE IF EXISTS role_permissions;
        DROP TABLE IF EXISTS permissions;
        DROP TABLE IF EXISTS roles;

        DROP TYPE IF EXISTS ledger_direction;
        DROP TYPE IF EXISTS account_type;
        DROP TYPE IF EXISTS refund_status;
        DROP TYPE IF EXISTS transaction_type;
        DROP TYPE IF EXISTS payment_status;
        DROP TYPE IF EXISTS payment_provider;
        DROP TYPE IF EXISTS booking_status;
        DROP TYPE IF EXISTS property_type;
        DROP TYPE IF EXISTS property_status;
        DROP TYPE IF EXISTS user_status;
        """
    )
