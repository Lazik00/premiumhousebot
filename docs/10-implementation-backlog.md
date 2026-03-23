# Premium House - Implementation Backlog (Async)

## Epic A - Platform Foundation

- [ ] A1: Async DB engine/session setup
- [ ] A2: Alembic migration pipeline
- [ ] A3: Config/secrets strategy
- [ ] A4: Structured logging + request-id middleware

Acceptance:

- backend async engine bilan ishlaydi
- migration apply/revert ishlaydi

## Epic B - Identity & Access

- [ ] B1: register/login API
- [ ] B2: OTP lifecycle
- [ ] B3: JWT refresh rotation
- [ ] B4: RBAC guard decorator/dependency

Acceptance:

- unauthorized accesslar 401/403 qaytaradi

## Epic C - Property Domain

- [ ] C1: Property CRUD
- [ ] C2: Image upload integration
- [ ] C3: Amenity mapping
- [ ] C4: Calendar update API

Acceptance:

- host faqat o'z listingini update qila oladi

## Epic D - Booking Engine

- [ ] D1: Quote calculation service
- [ ] D2: Booking create with idempotency
- [ ] D3: Redis lock manager
- [ ] D4: Pending expiry background job

Acceptance:

- 100 parallel requestda max 1 confirmed booking

## Epic E - Payment & Finance

- [ ] E1: Payment adapter interface
- [ ] E2: Click adapter
- [ ] E3: Payme adapter
- [ ] E4: Rahmat adapter
- [ ] E5: Webhook verification + dedupe
- [ ] E6: Refund/commission/payout flow

Acceptance:

- callback duplicate eventlar idempotent qayta ishlanadi

## Epic F - Experience Features

- [ ] F1: Reviews/replies
- [ ] F2: Wishlist
- [ ] F3: Promo code
- [ ] F4: Dynamic pricing
- [ ] F5: Notifications (email/sms/telegram)

## Epic G - Admin & Analytics

- [ ] G1: Admin KPI summary
- [ ] G2: Revenue charts API
- [ ] G3: Commission report
- [ ] G4: Host income report

## Epic H - Production Readiness

- [ ] H1: Rate limit and abuse controls
- [ ] H2: Observability (metrics, logs, alerts)
- [ ] H3: Security test (OWASP baseline)
- [ ] H4: Load test and scaling validation
- [ ] H5: Backup/restore drill

---

## Sprint 1 Immediate Tasks (Start now)

- [x] AsyncSession setup
- [x] `async def` endpoint conversion
- [x] booking/payment service async interface
- [x] health/ready checks async dependency ready
