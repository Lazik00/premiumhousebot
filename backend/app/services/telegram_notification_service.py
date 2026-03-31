import html
from datetime import date

import httpx


class TelegramNotificationService:
    def __init__(self, bot_token: str | None) -> None:
        self.bot_token = (bot_token or '').strip()
        self._cached_me: dict | None = None

    async def send_message(
        self,
        *,
        chat_id: int,
        text: str,
        parse_mode: str = 'HTML',
        reply_markup: dict | None = None,
        disable_web_page_preview: bool = True,
    ) -> dict | None:
        if not self.bot_token or not chat_id:
            return None

        payload: dict = {
            'chat_id': chat_id,
            'text': text,
            'parse_mode': parse_mode,
            'disable_web_page_preview': disable_web_page_preview,
        }
        if reply_markup is not None:
            payload['reply_markup'] = reply_markup
        return await self._post('sendMessage', payload)

    async def answer_callback_query(
        self,
        *,
        callback_query_id: str,
        text: str | None = None,
        show_alert: bool = False,
    ) -> dict | None:
        if not self.bot_token:
            return None
        payload = {'callback_query_id': callback_query_id, 'show_alert': show_alert}
        if text:
            payload['text'] = text
        return await self._post('answerCallbackQuery', payload)

    async def edit_message_reply_markup(
        self,
        *,
        chat_id: int,
        message_id: int,
        reply_markup: dict | None = None,
    ) -> dict | None:
        if not self.bot_token:
            return None
        payload: dict = {'chat_id': chat_id, 'message_id': message_id}
        if reply_markup is not None:
            payload['reply_markup'] = reply_markup
        return await self._post('editMessageReplyMarkup', payload)

    async def set_webhook(self, *, url: str, secret_token: str | None = None) -> bool:
        if not self.bot_token or not url:
            return False
        payload: dict = {
            'url': url,
            'allowed_updates': ['message', 'callback_query'],
            'drop_pending_updates': False,
        }
        if secret_token:
            payload['secret_token'] = secret_token
        response = await self._post('setWebhook', payload)
        return bool(response and response.get('ok'))

    async def get_bot_username(self) -> str | None:
        me = await self.get_me()
        username = (me or {}).get('username')
        return username if isinstance(username, str) and username else None

    async def get_me(self) -> dict | None:
        if self._cached_me is not None:
            return self._cached_me
        if not self.bot_token:
            return None
        self._cached_me = await self._post('getMe', {})
        return self._cached_me

    async def send_booking_confirmed(
        self,
        *,
        telegram_id: int | None,
        booking_code: str,
        property_title: str,
        property_address: str,
        city_name: str,
        start_date: date,
        end_date: date,
        total_nights: int,
        guests_total: int,
        total_price: float,
        currency: str,
    ) -> bool:
        if not self.bot_token or not telegram_id:
            return False

        amount_text = self._format_amount(total_price, currency)
        text = (
            '✅ <b>Bron tasdiqlandi</b>\n\n'
            f'🏠 <b>{html.escape(property_title)}</b>\n'
            f'📍 {html.escape(property_address)}, {html.escape(city_name)}\n'
            f'🗓 {start_date.strftime("%d.%m.%Y")} - {end_date.strftime("%d.%m.%Y")} '
            f'(<b>{total_nights}</b> kecha)\n'
            f'👥 <b>{guests_total}</b> mehmon\n'
            f'💳 <b>{html.escape(amount_text)}</b>\n'
            f'🔐 Kod: <code>#{html.escape(booking_code)}</code>\n\n'
            'Premium House tomonidan buyurtmangiz tasdiqlandi. Manzil va bron tafsilotlari ilova ichida saqlanadi.'
        )

        await self.send_message(chat_id=telegram_id, text=text)
        return True

    async def _post(self, method: str, payload: dict) -> dict | None:
        if not self.bot_token:
            return None
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                f'https://api.telegram.org/bot{self.bot_token}/{method}',
                json=payload,
            )
            response.raise_for_status()
            data = response.json()
        if not data.get('ok', False):
            raise RuntimeError(f'Telegram API {method} failed')
        return data.get('result')

    @staticmethod
    def _format_amount(amount: float, currency: str) -> str:
        if currency.upper() == 'USD':
            return f'${amount:,.2f}'
        return f"{int(round(amount)):,} so'm".replace(',', ' ')
