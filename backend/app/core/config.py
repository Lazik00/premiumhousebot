from pydantic import AnyUrl, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', env_file_encoding='utf-8', extra='ignore')

    app_name: str = 'Premium House API'
    api_prefix: str = '/api/v1'
    environment: str = 'development'
    debug: bool = True
    swagger_enabled: bool = True

    secret_key: str = Field(default='change-me-in-production')
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7

    default_commission_percent: float = 12.0
    booking_pending_expiry_minutes: int = 15

    telegram_bot_token: str = ''
    telegram_auth_max_age_seconds: int = 300

    database_url: str = Field(default='postgresql+asyncpg://premium:premium@postgres:5434/premium_house')
    db_pool_size: int = 20
    db_max_overflow: int = 40
    db_pool_timeout_seconds: int = 30

    redis_url: str = Field(default='redis://redis:6391/0')
    celery_broker_url: str = Field(default='redis://redis:6391/1')
    celery_result_backend: str = Field(default='redis://redis:6391/2')

    s3_endpoint: AnyUrl | None = None
    s3_bucket: str = 'premium-house'
    s3_access_key: str | None = None
    s3_secret_key: str | None = None

    click_secret: str | None = None
    payme_secret: str | None = None
    rahmat_secret: str | None = None

    payment_public_base_url: str | None = None

    click_checkout_url: str = 'https://my.click.uz/services/pay'
    click_service_id: str | None = None
    click_merchant_id: str | None = None
    click_merchant_user_id: str | None = None
    click_return_url: str | None = None
    click_callback_url: str | None = None

    payme_checkout_url: str = 'https://checkout.paycom.uz'
    payme_merchant_id: str | None = None
    payme_account_key: str = 'booking_id'
    payme_return_url: str | None = None
    payme_callback_url: str | None = None

    rahmat_checkout_url: str = 'https://pay.rahmat.uz/checkout'
    rahmat_merchant_id: str | None = None
    rahmat_return_url: str | None = None
    rahmat_callback_url: str | None = None


settings = Settings()
