from enum import Enum


class UserStatus(str, Enum):
    ACTIVE = 'active'
    BLOCKED = 'blocked'
    PENDING = 'pending'


class PropertyStatus(str, Enum):
    DRAFT = 'draft'
    PENDING_REVIEW = 'pending_review'
    ACTIVE = 'active'
    BLOCKED = 'blocked'
    ARCHIVED = 'archived'


class PropertyType(str, Enum):
    APARTMENT = 'apartment'
    HOUSE = 'house'
    VILLA = 'villa'


class BookingStatus(str, Enum):
    PENDING_PAYMENT = 'pending_payment'
    AWAITING_CONFIRMATION = 'awaiting_confirmation'
    CONFIRMED = 'confirmed'
    CANCELLED = 'cancelled'
    COMPLETED = 'completed'
    EXPIRED = 'expired'


class PaymentProvider(str, Enum):
    MANUAL = 'manual'
    RAHMAT = 'rahmat'
    CLICK = 'click'
    PAYME = 'payme'
    OCTO = 'octo'


class PaymentStatus(str, Enum):
    INITIATED = 'initiated'
    PENDING = 'pending'
    SUCCESS = 'success'
    FAILED = 'failed'
    CANCELLED = 'cancelled'
    REFUNDED = 'refunded'
    PARTIAL_REFUNDED = 'partial_refunded'


class TransactionType(str, Enum):
    PAYMENT_IN = 'payment_in'
    COMMISSION = 'commission'
    HOST_EARNING = 'host_earning'
    REFUND_OUT = 'refund_out'
    HOST_PAYOUT = 'host_payout'


class RefundStatus(str, Enum):
    PENDING = 'pending'
    SUCCESS = 'success'
    FAILED = 'failed'
    PARTIAL = 'partial'


class AccountType(str, Enum):
    PLATFORM = 'platform'
    HOST = 'host'


class LedgerDirection(str, Enum):
    DEBIT = 'debit'
    CREDIT = 'credit'
