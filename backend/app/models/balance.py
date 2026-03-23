import uuid

from sqlalchemy import Enum, ForeignKey, Index, Numeric, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin, enum_values
from app.models.enums import AccountType, LedgerDirection


class PlatformBalance(Base, UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = 'platform_balances'
    __table_args__ = (UniqueConstraint('currency', name='uq_platform_balance_currency'),)

    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    available_amount: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False, default=0)
    pending_amount: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False, default=0)


class HostBalance(Base, UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = 'host_balances'
    __table_args__ = (UniqueConstraint('host_id', 'currency', name='uq_host_balance_currency'),)

    host_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    available_amount: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False, default=0)
    pending_amount: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False, default=0)
    total_earned_amount: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False, default=0)
    total_paid_out_amount: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False, default=0)


class BalanceLedgerEntry(Base, UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = 'balance_ledger_entries'
    __table_args__ = (
        Index('idx_ledger_account', 'account_type', 'account_id', 'created_at'),
        Index('idx_ledger_booking', 'booking_id', 'created_at'),
    )

    account_type: Mapped[AccountType] = mapped_column(
        Enum(AccountType, name='account_type', values_callable=enum_values),
        nullable=False,
    )
    account_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)

    booking_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey('bookings.id'), nullable=True)
    payment_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey('payments.id'), nullable=True)
    transaction_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey('transactions.id'), nullable=True)

    direction: Mapped[LedgerDirection] = mapped_column(
        Enum(LedgerDirection, name='ledger_direction', values_callable=enum_values),
        nullable=False,
    )
    amount: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)

    description: Mapped[str | None] = mapped_column(String, nullable=True)
    reference_type: Mapped[str | None] = mapped_column(String(80), nullable=True)
    reference_id: Mapped[str | None] = mapped_column(String(120), nullable=True)
