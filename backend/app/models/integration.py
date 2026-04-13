import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Index, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin


class PropertyChannelCalendar(Base, UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = 'property_channel_calendars'
    __table_args__ = (
        UniqueConstraint('property_id', 'channel', name='uq_property_channel_calendars_property_channel'),
        UniqueConstraint('export_ical_token', name='uq_property_channel_calendars_export_token'),
        Index('idx_property_channel_calendars_channel', 'channel'),
        Index('idx_property_channel_calendars_property_enabled', 'property_id', 'is_enabled'),
    )

    property_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey('properties.id'), nullable=False)
    channel: Mapped[str] = mapped_column(String(40), nullable=False)
    import_ical_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    export_ical_token: Mapped[str] = mapped_column(String(96), nullable=False)
    is_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_sync_status: Mapped[str | None] = mapped_column(String(30), nullable=True)
    last_sync_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_sync_etag: Mapped[str | None] = mapped_column(String(255), nullable=True)
    last_sync_last_modified: Mapped[str | None] = mapped_column(String(255), nullable=True)


class ExternalCalendarEvent(Base, UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = 'external_calendar_events'
    __table_args__ = (
        UniqueConstraint('channel_calendar_id', 'external_uid', name='uq_external_calendar_events_channel_uid'),
        Index('idx_external_calendar_events_property_dates', 'property_id', 'start_date', 'end_date'),
        Index('idx_external_calendar_events_calendar_seen', 'channel_calendar_id', 'last_seen_at'),
    )

    property_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey('properties.id'), nullable=False)
    channel_calendar_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey('property_channel_calendars.id'),
        nullable=False,
    )
    external_uid: Mapped[str] = mapped_column(String(255), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    summary: Mapped[str | None] = mapped_column(String(255), nullable=True)
    raw_payload: Mapped[dict] = mapped_column('metadata', JSONB, nullable=False, default=dict)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class IntegrationDeliveryLog(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = 'integration_delivery_logs'
    __table_args__ = (
        UniqueConstraint('destination', 'event_key', name='uq_integration_delivery_logs_destination_event_key'),
        Index('idx_integration_delivery_logs_destination_created', 'destination', 'created_at'),
    )

    destination: Mapped[str] = mapped_column(String(80), nullable=False)
    event_key: Mapped[str] = mapped_column(String(255), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(80), nullable=False)
    entity_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    payload: Mapped[dict] = mapped_column('metadata', JSONB, nullable=False, default=dict)
    delivered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
