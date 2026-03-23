# Folder Structure (Enterprise Monorepo)

```text
PremiumHouse/
├── backend/
│   ├── app/
│   │   ├── api/v1/
│   │   ├── core/
│   │   ├── db/
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── services/
│   │   ├── tasks/
│   │   └── utils/
│   ├── alembic/
│   │   └── versions/
│   ├── tests/
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── app/
│   ├── components/
│   ├── lib/
│   ├── Dockerfile
│   ├── package.json
│   └── next.config.js
├── infra/
│   ├── docker-compose.yml
│   ├── nginx/
│   │   └── nginx.conf
│   └── certbot/
│       ├── conf/
│       └── www/
├── docs/
│   ├── 01-architecture.md
│   ├── 02-database-schema.sql
│   ├── 03-api-endpoints.md
│   ├── 04-booking-flow.md
│   ├── 05-payment-flow.md
│   ├── 06-deployment.md
│   ├── 07-folder-structure.md
│   ├── 08-async-master-plan.md
│   ├── 09-async-sprint-plan.md
│   ├── 10-implementation-backlog.md
│   ├── 11-go-live-plan.md
│   ├── 12-telegram-miniapp-architecture.md
│   ├── 13-telegram-db-schema.sql
│   └── 14-telegram-auth-verification.md
├── .github/workflows/
│   └── ci.yml
├── .env.example
└── README.md
```

## Layering Rules

- `api`: route definitions and request/response wiring
- `services`: business logic (booking, payment, commission), async-first orchestration
- `models`: SQLAlchemy entities
- `schemas`: Pydantic DTOs
- `tasks`: Celery jobs for async processing
- `infra`: runtime/deployment concerns only
