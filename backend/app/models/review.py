import uuid

from sqlalchemy import Boolean, ForeignKey, Index, SmallInteger, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin


class Review(Base, UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = 'reviews'
    __table_args__ = (
        UniqueConstraint('booking_id', name='uq_review_booking'),
        Index('idx_reviews_property_created', 'property_id', 'created_at'),
        Index('idx_reviews_user_created', 'user_id', 'created_at'),
    )

    booking_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey('bookings.id'), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=False)
    property_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey('properties.id'), nullable=False)
    rating: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    host_reply: Mapped[str | None] = mapped_column(Text, nullable=True)
    awaiting_comment: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
