import html
from datetime import date

import httpx


class TelegramNotificationService:
    def __init__(self, bot_token: str | None) -> None:
        self.bot_token = (bot_token or '').strip()

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

        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                f'https://api.telegram.org/bot{self.bot_token}/sendMessage',
                json={
                    'chat_id': telegram_id,
                    'text': text,
                    'parse_mode': 'HTML',
                    'disable_web_page_preview': True,
                },
            )
            response.raise_for_status()
        return True

    @staticmethod
    def _format_amount(amount: float, currency: str) -> str:
        if currency.upper() == 'USD':
            return f'${amount:,.2f}'
        return f"{int(round(amount)):,} so'm".replace(',', ' ')
