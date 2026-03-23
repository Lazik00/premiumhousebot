# Premium House - Async Sprint Plan (14 hafta)

Har sprint: 1 hafta (tez iteratsiya). Kerak bo'lsa 2 haftalik sprintga birlashtiriladi.

## Sprint 1 - Async Foundation

- FastAPI endpointlarni `async` ga o'tkazish
- Async SQLAlchemy session bazasi
- Redis client va lock helper
- CI import/smoke test

Exit kriteriy:

- local compose muhit barqaror
- kod style va test pipeline o'tadi

## Sprint 2 - Auth Core

- register/login (email/phone)
- password hashing
- JWT access/refresh
- refresh token storage/revoke

Exit kriteriy:

- `auth` endpointlari OpenAPI bilan mos

## Sprint 3 - OTP + RBAC

- OTP request/verify flow
- role/permission middleware
- admin role assignment

Exit kriteriy:

- rolega mos endpoint himoyasi test bilan yopilgan

## Sprint 4 - Property CRUD + Media

- property create/update/delete
- amenities bog'lash
- image upload pre-signed flow

Exit kriteriy:

- host o'z listingini to'liq boshqara oladi

## Sprint 5 - Search + Calendar

- property listing filter/search
- availability calendar read/write
- caching layer (Redis)

Exit kriteriy:

- check-in/check-out bilan filter ishlaydi

## Sprint 6 - Booking Engine

- booking quote
- booking create pending
- overlap lock + constraint handling

Exit kriteriy:

- parallel testda double booking yo'q

## Sprint 7 - Payment Integration 1

- unified payment service
- Click adapter (sandbox)
- preauthorize/capture flow

Exit kriteriy:

- happy-path booking confirmation ishlaydi

## Sprint 8 - Payment Integration 2

- Payme + Rahmat adapter
- webhook verification/idempotency
- failed payment recovery

Exit kriteriy:

- callback retrylarda state consistency saqlanadi

## Sprint 9 - Commission + Payout

- commission hisoblash
- transaction ledger
- host payout states

Exit kriteriy:

- admin commission report bilan solishtirganda to'g'ri natija

## Sprint 10 - Reviews + Notifications

- review/reply
- email/sms eventlar
- telegram opsional

Exit kriteriy:

- completed bookingdan keyin review ochiladi

## Sprint 11 - Wishlist + Promo + Dynamic Pricing

- wishlist CRUD
- promo validation/usage
- dynamic pricing rules

Exit kriteriy:

- final quote promo/pricing bilan to'g'ri

## Sprint 12 - Admin Analytics

- dashboard metrics
- revenue/commission API
- host income report

Exit kriteriy:

- dashboard API p95 < 500ms

## Sprint 13 - Security + Performance

- rate limit, CSP, secure headers
- load test va profiling
- query/index tuning

Exit kriteriy:

- NFR targetlarga erishiladi

## Sprint 14 - UAT + Go-Live

- E2E/UAT
- rollback drill
- production release

Exit kriteriy:

- go-live checklist to'liq yopilgan
