# Premium House - Go-Live Plan (Production)

## 1. Pre-Release Checklist

- [ ] DB migrations reviewed and applied in staging
- [ ] Payment sandbox -> production credential switch approved
- [ ] TLS certificates active
- [ ] Monitoring/alerts active
- [ ] Backup jobs + restore test passed
- [ ] Incident on-call roster approved

## 2. Release Day Timeline

1. Code freeze (`T-24h`)
2. Final smoke + E2E (`T-12h`)
3. Production deploy (`T-1h`)
4. DB migration (`T-30m`)
5. Readiness checks (`T-15m`)
6. Traffic open (`T0`)
7. Hypercare monitoring (`T+24h`)

## 3. Rollback Strategy

- application rollback: previous image tag deploy
- schema rollback: backward-compatible migration policy
- payment safety: new captures temporary pause during rollback

## 4. Post-Launch 7 kunlik fokus

- booking conversion
- payment success rate
- callback failure rate
- API p95 latency
- top error endpoints
