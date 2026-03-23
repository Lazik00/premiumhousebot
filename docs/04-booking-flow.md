# Booking Flow Logic (Concurrency-Safe)

## 1. Booking State Machine

`pending -> confirmed -> completed`

`pending -> cancelled`

`confirmed -> cancelled` (policy/exception based)

## 2. Critical Rules

- `check_out > check_in`
- booking date ranges must not overlap for active bookings
- booking remains `pending` until payment is successfully authorized/captured
- `pending` booking expires automatically (`expires_at`) if payment not completed in time

## 3. Sequence Diagram

```mermaid
sequenceDiagram
    participant C as Customer
    participant API as FastAPI
    participant R as Redis
    participant DB as PostgreSQL
    participant P as Payment Gateway

    C->>API: POST /bookings (idempotency-key)
    API->>R: Acquire lock(property_id + date range)
    alt lock acquired
        API->>DB: Validate property + availability + overlap
        DB-->>API: OK
        API->>DB: Insert booking(status=pending, expires_at=+15m)
        DB-->>API: booking_id
        API->>P: Pre-authorize payment
        P-->>API: auth result
        alt payment success
            API->>DB: Update booking(status=confirmed, confirmed_at)
            API->>DB: Insert payment + transactions + commission rows
            API-->>C: 201 Confirmed
        else payment failed
            API->>DB: Update booking(status=cancelled, reason=payment_failed)
            API-->>C: 402 Payment required/failed
        end
        API->>R: Release lock
    else lock denied
        API-->>C: 409 Booking in progress
    end
```

## 4. Server-Side Algorithm

1. Validate request payload and user role (`Customer`).
2. Compute lock key: `booking:{property_id}:{check_in}:{check_out}`.
3. Acquire Redis distributed lock with short TTL (e.g., 10 seconds).
4. In DB transaction:
- verify property is `active`
- verify calendar dates are available (if calendar overrides exist)
- rely on exclusion constraint to reject overlaps
- calculate pricing (`nights * price_per_night + fees - discount`)
- create `pending` booking with `expires_at`
5. Start payment pre-authorization with `payment_idempotency_key`.
6. On successful authorization/capture:
- set booking `confirmed`
- create `payments`, `transactions`, `commissions`, `host_payouts`
7. On failure:
- set booking `cancelled`
- keep payment audit records
8. Release Redis lock in `finally` block.

## 5. Idempotency Strategy

- Require `Idempotency-Key` header for booking creation.
- Persist key in `bookings.idempotency_key` unique partial index.
- If duplicate key is received, return existing booking result.

## 6. Background Jobs

- `expire_pending_bookings` every minute:
- find pending bookings with `expires_at < now()`
- cancel booking and free calendar blocks
- emit customer/host notifications

## 7. Failure Handling

- Redis lock failure -> `409 Conflict`
- DB exclusion violation -> `409 Conflict` (overlapping booking)
- payment timeout -> booking remains pending briefly, then async reconciliation updates final state
- retries use same idempotency key to avoid duplicate bookings
