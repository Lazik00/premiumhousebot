from pydantic import AnyUrl, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', env_file_encoding='utf-8', extra='ignore')

    app_name: str = 'Premium House API'
    api_prefix: str = '/api/v1'
    environment: str = 'development'
    debug: bool = False
    swagger_enabled: bool = False

    secret_key: str = Field(default='change-me-in-production')
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7

    default_commission_percent: float = 12.0
    booking_pending_expiry_minutes: int = 15
    cors_allowed_origins: str = 'http://localhost:3000,http://localhost:3100,http://localhost:8089'

    telegram_bot_token: str = ''
    telegram_auth_max_age_seconds: int = 300
    admin_bootstrap_email: str | None = None
    admin_bootstrap_password: str | None = None
    admin_bootstrap_first_name: str = 'Premium'
    admin_bootstrap_last_name: str = 'Admin'

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

    octo_prepare_url: str = 'https://secure.octo.uz/prepare_payment'
    octo_status_url: str = 'https://secure.octo.uz/prepare_payment'
    octo_refund_url: str = 'https://secure.octo.uz/refund'
    octo_shop_id: int | None = None
    octo_secret: str | None = None
    octo_unique_key: str | None = None
    octo_return_url: str | None = None
    octo_notify_url: str | None = None
    octo_auto_capture: bool = True
    octo_test_mode: bool = False
    octo_ttl_minutes: int = 15
    octo_language: str = 'uz'
    octo_payment_methods: str = 'bank_card,uzcard,humo'

    @field_validator('octo_shop_id', mode='before')
    @classmethod
    def _blank_int_to_none(cls, value):
        if value in ('', None):
            return None
        return value

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_allowed_origins.split(',') if origin.strip()]

    @property
    def octo_payment_method_list(self) -> list[str]:
        return [method.strip() for method in self.octo_payment_methods.split(',') if method.strip()]


settings = Settings()
