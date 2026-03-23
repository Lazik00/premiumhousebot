import hashlib
import hmac
import json
import time
from dataclasses import dataclass
from urllib.parse import parse_qsl


class TelegramAuthError(ValueError):
    pass


@dataclass
class TelegramIdentity:
    telegram_id: int
    first_name: str
    last_name: str | None
    username: str | None
    photo_url: str | None
    auth_date: int


class TelegramAuthService:
    def __init__(self, bot_token: str, max_age_seconds: int = 300) -> None:
        if not bot_token:
            raise TelegramAuthError('Telegram bot token is not configured')
        self.bot_token = bot_token
        self.max_age_seconds = max_age_seconds

    def verify_init_data(self, init_data: str) -> TelegramIdentity:
        params = dict(parse_qsl(init_data, keep_blank_values=True))
        received_hash = params.pop('hash', None)
        if not received_hash:
            raise TelegramAuthError('initData hash is missing')

        auth_date = self._parse_auth_date(params)
        if not self._is_fresh(auth_date):
            raise TelegramAuthError('initData auth_date is stale')

        data_check_string = '\n'.join(f'{key}={value}' for key, value in sorted(params.items()))
        secret_key = hmac.new(b'WebAppData', self.bot_token.encode('utf-8'), hashlib.sha256).digest()
        expected_hash = hmac.new(secret_key, data_check_string.encode('utf-8'), hashlib.sha256).hexdigest()

        if not hmac.compare_digest(expected_hash, received_hash):
            raise TelegramAuthError('initData hash verification failed')

        user_payload = self._extract_user_payload(params)
        return TelegramIdentity(
            telegram_id=int(user_payload['id']),
            first_name=user_payload.get('first_name', ''),
            last_name=user_payload.get('last_name'),
            username=user_payload.get('username'),
            photo_url=user_payload.get('photo_url'),
            auth_date=auth_date,
        )

    @staticmethod
    def _parse_auth_date(params: dict[str, str]) -> int:
        raw = params.get('auth_date')
        if not raw:
            raise TelegramAuthError('auth_date is missing')
        try:
            return int(raw)
        except ValueError as exc:
            raise TelegramAuthError('auth_date is invalid') from exc

    def _is_fresh(self, auth_date: int) -> bool:
        now = int(time.time())
        if auth_date > now + 60:
            return False
        return (now - auth_date) <= self.max_age_seconds

    @staticmethod
    def _extract_user_payload(params: dict[str, str]) -> dict:
        raw_user = params.get('user')
        if not raw_user:
            raise TelegramAuthError('user payload is missing in initData')

        try:
            payload = json.loads(raw_user)
        except json.JSONDecodeError as exc:
            raise TelegramAuthError('user payload json is invalid') from exc

        if 'id' not in payload:
            raise TelegramAuthError('user.id is missing in initData payload')
        return payload
