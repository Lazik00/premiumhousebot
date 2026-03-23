# Telegram initData Verification Logic

## Endpoint

- `POST /api/v1/auth/telegram`

Request body:

```json
{
  "initData": "query_id=...&user=%7B...%7D&auth_date=...&hash=..."
}
```

## Verification Steps

1. Parse `initData` query params.
2. Extract `hash` and remove it from payload.
3. Validate `auth_date` freshness (`<= TELEGRAM_AUTH_MAX_AGE_SECONDS`).
4. Build `data_check_string` from sorted `key=value` lines.
5. Compute secret key:
- `secret = HMAC_SHA256(key="WebAppData", msg=BOT_TOKEN)`
6. Compute expected hash:
- `expected_hash = HMAC_SHA256(key=secret, msg=data_check_string).hex()`
7. Compare with `hmac.compare_digest(expected_hash, received_hash)`.
8. Parse `user` JSON and map fields:
- `telegram_id`
- `first_name`
- `last_name`
- `username`
- `photo_url`
9. Upsert user and issue JWT pair.
10. Hash refresh token and store in DB for rotation/revocation.

## Security Controls

1. Reject missing/invalid hash.
2. Reject stale `auth_date`.
3. Reject malformed `user` JSON.
4. Do not trust frontend user data without server-side signature verification.
5. Log auth attempts into `auth_audit_logs`.

## Code References

- `backend/app/services/telegram_auth_service.py`
- `backend/app/services/telegram_user_service.py`
- `backend/app/api/v1/router.py`
