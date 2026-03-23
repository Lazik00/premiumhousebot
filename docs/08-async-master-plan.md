# Premium House - To'liq Async Implementation Master Plan

## 1. Maqsad

Mavjud arxitektura hujjatlariga tayangan holda Premium House platformasini production darajada, `async-first` uslubida bosqichma-bosqich ishlab chiqish.

Asosiy natija:

- booking/payments da yuqori yuklama ostida barqarorlik
- double booking ga yo'l qo'ymaslik
- payment callback larni ishonchli qayta ishlash
- Uzbekistan bozori uchun lokalizatsiyalangan ishchi tizim

## 2. Async-First Tamoyillar

1. FastAPI endpointlar `async def`.
2. DB qatlam `SQLAlchemy AsyncSession` + `asyncpg`.
3. Tashqi servis chaqiruvlari (`payment`, `sms`, `email`) `httpx.AsyncClient` orqali.
4. I/O og'ir vazifalar background queue (Celery) ga chiqariladi.
5. Redis lock va idempotency booking/payment uchun majburiy.
6. Har bir state o'zgarishi audit log va event bilan qayd etiladi.

## 3. Bosqichlar

## Phase 0 - Foundation (1-hafta)

Deliverables:

- async backend skeleton
- environment, secrets, config strategy
- migration pipeline (Alembic)
- lint/format/test bazasi

Done mezoni:

- `docker compose up` bilan frontend+backend+db+redis ishga tushadi
- `/api/v1/health` va `/api/v1/ready` yashil

## Phase 1 - Identity & RBAC (2-3-hafta)

Deliverables:

- email/phone login
- OTP request/verify
- JWT access + refresh rotation
- role + permission middleware

Done mezoni:

- 4 rol (`SuperAdmin`, `Admin`, `Host`, `Customer`) endpointlarda ishlaydi
- refresh token revocation mavjud

## Phase 2 - Property Domain (4-5-hafta)

Deliverables:

- host listing CRUD
- image upload flow (S3 compatible)
- amenity va calendar management
- admin moderation flow

Done mezoni:

- active listing search da ko'rinadi
- blocked/pending listing public da ko'rinmaydi

## Phase 3 - Booking Core (6-7-hafta)

Deliverables:

- quote API
- booking create/cancel/complete
- overlap prevention + Redis lock
- pending booking expiration job

Done mezoni:

- parallel booking urinishlarida bitta booking confirmed bo'ladi
- idempotency key takrorida duplicate yozuv yaratilmaydi

## Phase 4 - Payments & Commissions (8-9-hafta)

Deliverables:

- provider adapter layer (Click/Payme/Rahmat)
- preauth/capture/refund flow
- webhook verification + idempotent processing
- commissions + host payouts

Done mezoni:

- payment muvaffaqiyatida booking `confirmed`
- callback qayta yuborilganda state buzilmaydi

## Phase 5 - Reviews, Notifications, Wishlist, Promo (10-11-hafta)

Deliverables:

- post-stay reviews + host reply
- notification fanout (email/sms/telegram)
- wishlist va promo code
- dynamic pricing rules (host)

Done mezoni:

- faqat completed booking review qoldira oladi
- promo validatsiya pricing ga to'g'ri qo'llanadi

## Phase 6 - Admin Analytics & Hardening (12-13-hafta)

Deliverables:

- admin dashboard KPI
- host income report
- rate limit, WAF, CSP, secure headers
- monitoring + alerting + tracing

Done mezoni:

- asosiy metrikalar dashboardda real-time/yoki near-real-time chiqadi
- security checklist yopiladi

## Phase 7 - UAT & Go-Live (14-hafta)

Deliverables:

- load test
- DR/backup test
- production release + rollback playbook

Done mezoni:

- go-live checklist 100% bajarilgan

## 4. Non-Functional SLO

- API p95 latency: < 300ms (read endpoints)
- Booking create p95: < 700ms (payment callsiz)
- Uptime target: 99.9%
- Payment callback processing success: > 99.95%

## 5. Risklar va Mitigatsiya

1. Payment provider farqlari: adapter contract va sandbox testing.
2. Booking race condition: Redis lock + DB exclusion constraint.
3. SMS delivery kechikishi: multi-provider fallback.
4. Peak load: autoscaling + caching + queue backpressure.

## 6. Boshqaruv Modeli

- Haftalik architecture review
- Sprint demo + retro
- Release branch governance
- Production change faqat checklist asosida
