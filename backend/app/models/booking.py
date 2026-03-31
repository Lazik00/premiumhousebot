import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, Enum, ForeignKey, Index, Numeric, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin, enum_values
from app.models.enums import BookingStatus


class Booking(Base, UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = 'bookings'
    __table_args__ = (
        UniqueConstraint('user_id', 'idempotency_key', name='uq_booking_user_idempotency'),
        Index('idx_bookings_property_dates', 'property_id', 'start_date', 'end_date'),
        Index('idx_bookings_user_status', 'user_id', 'status'),
        Index('idx_bookings_status_expiry', 'status', 'expires_at'),
    )

    booking_code: Mapped[str] = mapped_column(String(40), nullable=False, unique=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=False)
    property_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey('properties.id'), nullable=False)

    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    total_nights: Mapped[int] = mapped_column(nullable=False)

    guests_total: Mapped[int] = mapped_column(nullable=False, default=1)
    guests_adults_men: Mapped[int] = mapped_column(nullable=False, default=0)
    guests_adults_women: Mapped[int] = mapped_column(nullable=False, default=0)
    guests_children: Mapped[int] = mapped_column(nullable=False, default=0)

    price_per_night_snapshot: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    cleaning_fee_snapshot: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    service_fee_snapshot: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    platform_commission_snapshot: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    host_earning_snapshot: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    total_price: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    commission_percent_snapshot: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)

    status: Mapped[BookingStatus] = mapped_column(
        Enum(BookingStatus, name='booking_status', values_callable=enum_values),
        nullable=False,
        default=BookingStatus.PENDING_PAYMENT,
    )

    idempotency_key: Mapped[str] = mapped_column(String(120), nullable=False)

    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    review_prompt_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cancel_reason: Mapped[str | None] = mapped_column(Text, nullable=True)


class BookingEvent(Base, UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = 'booking_events'
    __table_args__ = (Index('idx_booking_events_booking', 'booking_id', 'created_at'),)

    booking_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey('bookings.id'), nullable=False)
    old_status: Mapped[BookingStatus | None] = mapped_column(
        Enum(BookingStatus, name='booking_status', values_callable=enum_values),
        nullable=True,
    )
    new_status: Mapped[BookingStatus | None] = mapped_column(
        Enum(BookingStatus, name='booking_status', values_callable=enum_values),
        nullable=True,
    )
    event_type: Mapped[str] = mapped_column(String(80), nullable=False)
    event_payload: Mapped[dict] = mapped_column('metadata', JSONB, nullable=False, default=dict)
