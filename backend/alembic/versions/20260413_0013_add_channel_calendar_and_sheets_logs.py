"""add channel calendar sync and integration delivery logs

Revision ID: 20260413_0013
Revises: 20260331_0012
Create Date: 2026-04-13 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '20260413_0013'
down_revision: Union[str, None] = '20260331_0012'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'property_channel_calendars',
        sa.Column('property_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('channel', sa.String(length=40), nullable=False),
        sa.Column('import_ical_url', sa.Text(), nullable=True),
        sa.Column('export_ical_token', sa.String(length=96), nullable=False),
        sa.Column('is_enabled', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('last_synced_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('last_sync_status', sa.String(length=30), nullable=True),
        sa.Column('last_sync_error', sa.Text(), nullable=True),
        sa.Column('last_sync_etag', sa.String(length=255), nullable=True),
        sa.Column('last_sync_last_modified', sa.String(length=255), nullable=True),
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['property_id'], ['properties.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('property_id', 'channel', name='uq_property_channel_calendars_property_channel'),
        sa.UniqueConstraint('export_ical_token', name='uq_property_channel_calendars_export_token'),
    )
    op.create_index(
        'idx_property_channel_calendars_channel',
        'property_channel_calendars',
        ['channel'],
    )
    op.create_index(
        'idx_property_channel_calendars_property_enabled',
        'property_channel_calendars',
        ['property_id', 'is_enabled'],
    )

    op.create_table(
        'external_calendar_events',
        sa.Column('property_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('channel_calendar_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('external_uid', sa.String(length=255), nullable=False),
        sa.Column('start_date', sa.Date(), nullable=False),
        sa.Column('end_date', sa.Date(), nullable=False),
        sa.Column('summary', sa.String(length=255), nullable=True),
        sa.Column('metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column('last_seen_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['channel_calendar_id'], ['property_channel_calendars.id']),
        sa.ForeignKeyConstraint(['property_id'], ['properties.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('channel_calendar_id', 'external_uid', name='uq_external_calendar_events_channel_uid'),
    )
    op.create_index(
        'idx_external_calendar_events_property_dates',
        'external_calendar_events',
        ['property_id', 'start_date', 'end_date'],
    )
    op.create_index(
        'idx_external_calendar_events_calendar_seen',
        'external_calendar_events',
        ['channel_calendar_id', 'last_seen_at'],
    )

    op.create_table(
        'integration_delivery_logs',
        sa.Column('destination', sa.String(length=80), nullable=False),
        sa.Column('event_key', sa.String(length=255), nullable=False),
        sa.Column('entity_type', sa.String(length=80), nullable=False),
        sa.Column('entity_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column('delivered_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('destination', 'event_key', name='uq_integration_delivery_logs_destination_event_key'),
    )
    op.create_index(
        'idx_integration_delivery_logs_destination_created',
        'integration_delivery_logs',
        ['destination', 'created_at'],
    )


def downgrade() -> None:
    op.drop_index('idx_integration_delivery_logs_destination_created', table_name='integration_delivery_logs')
    op.drop_table('integration_delivery_logs')

    op.drop_index('idx_external_calendar_events_calendar_seen', table_name='external_calendar_events')
    op.drop_index('idx_external_calendar_events_property_dates', table_name='external_calendar_events')
    op.drop_table('external_calendar_events')

    op.drop_index('idx_property_channel_calendars_property_enabled', table_name='property_channel_calendars')
    op.drop_index('idx_property_channel_calendars_channel', table_name='property_channel_calendars')
    op.drop_table('property_channel_calendars')
