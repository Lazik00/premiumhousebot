# Premium House

Production-ready architecture blueprint and implementation scaffold for a rental-only booking marketplace (Uzbekistan-focused).

## Scope Included

- Async-first system architecture (FastAPI + Next.js + PostgreSQL + Redis + Celery)
- Enterprise-grade normalized database schema with constraints and indexes
- API endpoint catalog (RBAC-aware)
- Booking and payment flow design with concurrency and idempotency controls
- Deployment design (Docker Compose + Nginx + Let's Encrypt + CI/CD)
- Monorepo folder structure for backend, frontend, and infrastructure

## Documents

- `docs/01-architecture.md`
- `docs/02-database-schema.sql`
- `docs/03-api-endpoints.md`
- `docs/04-booking-flow.md`
- `docs/05-payment-flow.md`
- `docs/06-deployment.md`
- `docs/07-folder-structure.md`
- `docs/08-async-master-plan.md`
- `docs/09-async-sprint-plan.md`
- `docs/10-implementation-backlog.md`
- `docs/11-go-live-plan.md`
- `docs/12-telegram-miniapp-architecture.md`
- `docs/13-telegram-db-schema.sql`
- `docs/14-telegram-auth-verification.md`

## Quick Start (Scaffold)

1. Copy environment variables:
   - `cp .env.example .env`
2. Start services:
   - `docker compose -f infra/docker-compose.yml up -d --build`
3. Access:
   - Frontend: `http://localhost`
   - Backend API: `http://localhost/api/v1/health`

## Notes

- Payment adapters are designed for Click, Payme, and Rahmat integrations.
- Airbnb/Booking calendar sync is implemented via iCal import/export (`/api/v1/integrations/ical/{token}.ics`) with admin channel settings per property.
- Google Sheets booking export is supported via service account credentials (`GOOGLE_SHEETS_*` env vars).
- Currency defaults to `UZS`, timezone defaults to `Asia/Tashkent`.
- This scaffold is intended as a strong production baseline and can be extended by implementing full business logic in backend services.
