import json
from datetime import UTC, datetime

import httpx

from app.core.config import settings
from app.db.redis import redis_client
from app.schemas.app_config import ExchangeRateResponse, PublicAppConfigResponse


class AppConfigService:
    cache_key = 'app_config:usd_uzs_rate:v1'

    async def get_public_config(self) -> PublicAppConfigResponse:
        exchange_rate = await self.get_exchange_rate()
        return PublicAppConfigResponse(
            default_language='uz',
            default_currency='UZS',
            available_languages=['uz', 'ru', 'en'],
            available_currencies=['UZS', 'USD'],
            exchange_rate=exchange_rate,
        )

    async def get_exchange_rate(self) -> ExchangeRateResponse:
        cached = await self._get_cached_rate()
        if cached:
            return cached

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(settings.exchange_rate_source_url)
                response.raise_for_status()
                payload = response.json()
        except Exception:
            return self._build_fallback_rate()

        if not isinstance(payload, list) or not payload:
            return self._build_fallback_rate()

        latest = payload[0]
        try:
            rate = float(latest['Rate'])
            effective_date = datetime.strptime(latest['Date'], '%d.%m.%Y').date().isoformat()
        except (KeyError, TypeError, ValueError):
            return self._build_fallback_rate()

        exchange_rate = ExchangeRateResponse(
            usd_to_uzs=rate,
            effective_date=effective_date,
            fetched_at=datetime.now(UTC),
            source=settings.exchange_rate_source_url,
        )
        await self._cache_rate(exchange_rate)
        return exchange_rate

    async def _get_cached_rate(self) -> ExchangeRateResponse | None:
        try:
            raw = await redis_client.get(self.cache_key)
        except Exception:
            return None

        if not raw:
            return None

        try:
            payload = json.loads(raw)
            return ExchangeRateResponse.model_validate(payload)
        except (json.JSONDecodeError, ValueError, TypeError):
            return None

    async def _cache_rate(self, exchange_rate: ExchangeRateResponse) -> None:
        try:
            await redis_client.setex(
                self.cache_key,
                settings.exchange_rate_cache_ttl_seconds,
                exchange_rate.model_dump_json(),
            )
        except Exception:
            return

    def _build_fallback_rate(self) -> ExchangeRateResponse:
        return ExchangeRateResponse(
            usd_to_uzs=settings.fallback_usd_to_uzs_rate,
            effective_date=datetime.now(UTC).date().isoformat(),
            fetched_at=datetime.now(UTC),
            source='fallback',
        )
