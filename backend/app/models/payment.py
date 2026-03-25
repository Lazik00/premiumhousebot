import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Index, Numeric, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin, enum_values
from app.models.enums import PaymentProvider, PaymentStatus, RefundStatus, TransactionType


class Payment(Base, UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = 'payments'
    __table_args__ = (
        UniqueConstraint('provider', 'provider_payment_id', name='uq_provider_payment_id'),
        UniqueConstraint('booking_id', 'provider', 'idempotency_key', name='uq_payment_booking_provider_idempotency'),
        Index('idx_payments_booking', 'booking_id'),
        Index('idx_payments_status', 'status'),
    )

    booking_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey('bookings.id'), nullable=False)
    provider: Mapped[PaymentProvider] = mapped_column(
        Enum(PaymentProvider, name='payment_provider', values_callable=enum_values),
        nullable=False,
    )
    provider_payment_id: Mapped[str | None] = mapped_column(String(120), nullable=True)
    payment_url: Mapped[str | None] = mapped_column(Text, nullable=True)

    amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default='UZS')
    status: Mapped[PaymentStatus] = mapped_column(
        Enum(PaymentStatus, name='payment_status', values_callable=enum_values),
        nullable=False,
        default=PaymentStatus.INITIATED,
    )

    idempotency_key: Mapped[str] = mapped_column(String(120), nullable=False)
    raw_request: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    raw_response: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)

    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    failed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class PaymentCallback(Base, UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = 'payment_callbacks'
    __table_args__ = (UniqueConstraint('provider', 'provider_event_id', name='uq_callback_provider_event'),)

    payment_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey('payments.id'), nullable=True)
    provider: Mapped[PaymentProvider] = mapped_column(
        Enum(PaymentProvider, name='payment_provider', values_callable=enum_values),
        nullable=False,
    )
    provider_event_id: Mapped[str] = mapped_column(String(120), nullable=False)
    signature: Mapped[str] = mapped_column(String(255), nullable=False)
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    is_valid: Mapped[bool] = mapped_column(nullable=False, default=False)
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Transaction(Base, UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = 'transactions'
    __table_args__ = (Index('idx_transactions_booking_type', 'booking_id', 'txn_type'),)

    booking_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey('bookings.id'), nullable=False)
    payment_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey('payments.id'), nullable=True)

    txn_type: Mapped[TransactionType] = mapped_column(
        Enum(TransactionType, name='transaction_type', values_callable=enum_values),
        nullable=False,
    )
    amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default='UZS')
    provider_reference: Mapped[str | None] = mapped_column(String(120), nullable=True)
    txn_metadata: Mapped[dict] = mapped_column('metadata', JSONB, nullable=False, default=dict)


class Refund(Base, UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = 'refunds'
    __table_args__ = (UniqueConstraint('idempotency_key', name='uq_refund_idempotency_key'),)

    booking_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey('bookings.id'), nullable=False)
    payment_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey('payments.id'), nullable=False)
    provider: Mapped[PaymentProvider] = mapped_column(
        Enum(PaymentProvider, name='payment_provider', values_callable=enum_values),
        nullable=False,
    )

    amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    status: Mapped[RefundStatus] = mapped_column(
        Enum(RefundStatus, name='refund_status', values_callable=enum_values),
        nullable=False,
    )
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    provider_refund_id: Mapped[str | None] = mapped_column(String(120), nullable=True)

    idempotency_key: Mapped[str] = mapped_column(String(120), nullable=False)
    requested_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=True)
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
