import html
import uuid
from datetime import datetime
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.booking import Booking
from app.models.user import User
from app.services.auth_service import AuthService
from app.services.review_service import ReviewService
from app.services.telegram_notification_service import TelegramNotificationService


class TelegramBotService:
    def __init__(self) -> None:
        self.notifications = TelegramNotificationService(settings.telegram_bot_token)
        self.auth_service = AuthService()
        self.review_service = ReviewService()
        self.local_zone = ZoneInfo('Asia/Tashkent')

    async def ensure_webhook(self) -> bool:
        webhook_url = settings.resolved_telegram_webhook_url
        if not settings.telegram_bot_token or not webhook_url:
            return False
        try:
            return await self.notifications.set_webhook(
                url=webhook_url,
                secret_token=settings.telegram_webhook_secret or None,
            )
        except Exception:
            return False

    async def handle_update(self, db: AsyncSession, update: dict) -> None:
        if message := update.get('message'):
            await self._handle_message(db, message)
            return
        if callback_query := update.get('callback_query'):
            await self._handle_callback_query(db, callback_query)

    async def _handle_message(self, db: AsyncSession, message: dict) -> None:
        from_user = message.get('from') or {}
        chat = message.get('chat') or {}
        text = (message.get('text') or '').strip()
        chat_id = chat.get('id')

        if not text or not chat_id or not from_user.get('id'):
            return

        user = await self._sync_user(db, from_user)
        locale = self._resolve_locale(user, from_user)

        if text.startswith('/start'):
            await db.commit()
            await self.notifications.send_message(
                chat_id=chat_id,
                text=self._welcome_text(locale),
                reply_markup=await self._welcome_markup(locale),
            )
            return

        saved_review = await self.review_service.submit_pending_comment(
            db=db,
            telegram_id=int(from_user['id']),
            comment=text,
        )
        if saved_review is not None:
            await self.notifications.send_message(
                chat_id=chat_id,
                text=self._review_comment_saved_text(locale),
            )

    async def _handle_callback_query(self, db: AsyncSession, callback_query: dict) -> None:
        callback_query_id = callback_query.get('id')
        from_user = callback_query.get('from') or {}
        message = callback_query.get('message') or {}
        chat = message.get('chat') or {}
        message_id = message.get('message_id')
        chat_id = chat.get('id')
        data = callback_query.get('data') or ''

        if not callback_query_id or not chat_id or not from_user.get('id'):
            return

        user = await self._sync_user(db, from_user)
        locale = self._resolve_locale(user, from_user)
        local_today = datetime.now(self.local_zone).date()

        if data.startswith('review:rate:'):
            parts = data.split(':')
            if len(parts) != 4:
                return
            try:
                booking_id = uuid.UUID(parts[2])
                rating = int(parts[3])
            except ValueError:
                return

            try:
                review, booking, _user = await self.review_service.create_or_update_rating_for_telegram_user(
                    db=db,
                    booking_id=booking_id,
                    telegram_id=int(from_user['id']),
                    rating=rating,
                    local_today=local_today,
                )
            except ValueError as exc:
                await self.notifications.answer_callback_query(
                    callback_query_id=callback_query_id,
                    text=str(exc),
                    show_alert=True,
                )
                return

            await self.notifications.answer_callback_query(
                callback_query_id=callback_query_id,
                text=self._rating_saved_text(locale, rating),
            )
            if message_id:
                try:
                    await self.notifications.edit_message_reply_markup(
                        chat_id=chat_id,
                        message_id=message_id,
                        reply_markup=self._rated_review_markup(booking.id, locale),
                    )
                except Exception:
                    pass
            await self.notifications.send_message(
                chat_id=chat_id,
                text=self._review_followup_text(locale, review.rating),
                reply_markup=self._comment_cta_markup(booking.id, locale),
            )
            return

        if data.startswith('review:comment:'):
            parts = data.split(':')
            if len(parts) != 3:
                return
            try:
                booking_id = uuid.UUID(parts[2])
            except ValueError:
                return

            try:
                await self.review_service.request_comment_for_telegram_user(
                    db=db,
                    booking_id=booking_id,
                    telegram_id=int(from_user['id']),
                    local_today=local_today,
                )
            except ValueError as exc:
                await self.notifications.answer_callback_query(
                    callback_query_id=callback_query_id,
                    text=str(exc),
                    show_alert=True,
                )
                return

            await self.notifications.answer_callback_query(
                callback_query_id=callback_query_id,
                text=self._comment_requested_text(locale),
            )
            await self.notifications.send_message(
                chat_id=chat_id,
                text=self._comment_prompt_text(locale),
            )

    async def _sync_user(self, db: AsyncSession, telegram_user: dict) -> User:
        telegram_id = int(telegram_user['id'])
        result = await db.execute(
            select(User).where(
                User.telegram_id == telegram_id,
                User.deleted_at.is_(None),
            )
        )
        user = result.scalar_one_or_none()
        language_code = (telegram_user.get('language_code') or 'uz')[:2]
        if language_code not in {'uz', 'ru', 'en'}:
            language_code = 'uz'

        if user is None:
            await self.auth_service.ensure_default_roles(db)
            user = User(
                telegram_id=telegram_id,
                first_name=telegram_user.get('first_name') or 'Premium House',
                last_name=telegram_user.get('last_name'),
                username=telegram_user.get('username'),
                language_code=language_code,
                time_zone='Asia/Tashkent',
            )
            db.add(user)
            await db.flush()
            await self.auth_service._assign_role(db, user.id, 'customer')
            return user

        user.first_name = telegram_user.get('first_name') or user.first_name
        user.last_name = telegram_user.get('last_name') or user.last_name
        user.username = telegram_user.get('username') or user.username
        if not user.language_code or user.language_code not in {'uz', 'ru', 'en'}:
            user.language_code = language_code
        return user

    async def _welcome_markup(self, locale: str) -> dict:
        buttons = []
        mini_app_url = settings.resolved_telegram_mini_app_url
        labels = {
            'uz': {
                'open': 'Mini Appni ochish',
                'contact': 'Aloqaga chiqish',
            },
            'ru': {
                'open': 'Открыть mini app',
                'contact': 'Связаться',
            },
            'en': {
                'open': 'Open mini app',
                'contact': 'Contact support',
            },
        }[locale]
        if mini_app_url:
            buttons.append([{'text': labels['open'], 'web_app': {'url': mini_app_url}}])

        support_url = await self._resolve_support_url()
        if support_url:
            buttons.append([{'text': labels['contact'], 'url': support_url}])

        return {'inline_keyboard': buttons}

    async def _resolve_support_url(self) -> str | None:
        if settings.telegram_support_url:
            return settings.telegram_support_url
        username = await self.notifications.get_bot_username()
        if username:
            return f'https://t.me/{username}'
        return settings.resolved_telegram_mini_app_url

    @staticmethod
    def _resolve_locale(user: User, telegram_user: dict) -> str:
        preferred = (user.language_code or telegram_user.get('language_code') or 'uz')[:2]
        return preferred if preferred in {'uz', 'ru', 'en'} else 'uz'

    @staticmethod
    def _stars(rating: int) -> str:
        return '★' * rating + '☆' * (5 - rating)

    def _welcome_text(self, locale: str) -> str:
        texts = {
            'uz': (
                '✨ <b>Premium House\'ga xush kelibsiz</b>\n\n'
                'Premium uylarni ko‘ring, bron qiling va buyurtmalaringizni bitta mini app ichida boshqaring.\n\n'
                'Pastdagi tugmalar orqali mini appni ochishingiz yoki aloqa bo‘limiga o‘tishingiz mumkin.'
            ),
            'ru': (
                '✨ <b>Добро пожаловать в Premium House</b>\n\n'
                'Смотрите премиальные дома, бронируйте и управляйте заказами в одном mini app.\n\n'
                'Используйте кнопки ниже, чтобы открыть mini app или перейти на связь.'
            ),
            'en': (
                '✨ <b>Welcome to Premium House</b>\n\n'
                'Browse premium homes, book stays, and manage your orders in one mini app.\n\n'
                'Use the buttons below to open the mini app or contact support.'
            ),
        }
        return texts[locale]

    def review_prompt_text(
        self,
        *,
        locale: str,
        booking_code: str,
        property_title: str,
        city_name: str,
    ) -> str:
        title = html.escape(property_title)
        city = html.escape(city_name)
        code = html.escape(booking_code)
        texts = {
            'uz': (
                '🏡 <b>Safaringiz yakunlandi</b>\n\n'
                f'<b>{title}</b>\n'
                f'📍 {city}\n'
                f'🔐 Kod: <code>#{code}</code>\n\n'
                'Uy sizga yoqdimi? Quyidagi inline baholash tugmalaridan birini tanlang.'
            ),
            'ru': (
                '🏡 <b>Ваше проживание завершилось</b>\n\n'
                f'<b>{title}</b>\n'
                f'📍 {city}\n'
                f'🔐 Код: <code>#{code}</code>\n\n'
                'Понравился ли вам дом? Выберите оценку кнопками ниже.'
            ),
            'en': (
                '🏡 <b>Your stay has ended</b>\n\n'
                f'<b>{title}</b>\n'
                f'📍 {city}\n'
                f'🔐 Code: <code>#{code}</code>\n\n'
                'Did you like the home? Please choose a rating below.'
            ),
        }
        return texts[locale]

    def review_prompt_markup(self, booking_id: uuid.UUID, locale: str) -> dict:
        star_row = [
            {'text': f'{rating}★', 'callback_data': f'review:rate:{booking_id}:{rating}'}
            for rating in range(1, 6)
        ]
        button_text = {
            'uz': 'Mini Appni ochish',
            'ru': 'Открыть mini app',
            'en': 'Open mini app',
        }[locale]
        keyboard = [star_row]
        if settings.resolved_telegram_mini_app_url:
            keyboard.append([{'text': button_text, 'web_app': {'url': settings.resolved_telegram_mini_app_url}}])
        return {'inline_keyboard': keyboard}

    def _rated_review_markup(self, booking_id: uuid.UUID, locale: str) -> dict:
        return self._comment_cta_markup(booking_id, locale)

    @staticmethod
    def _comment_cta_markup(booking_id: uuid.UUID, locale: str) -> dict:
        labels = {
            'uz': 'Izoh qoldirish',
            'ru': 'Оставить комментарий',
            'en': 'Leave a comment',
        }
        return {'inline_keyboard': [[{'text': labels[locale], 'callback_data': f'review:comment:{booking_id}'}]]}

    def _rating_saved_text(self, locale: str, rating: int) -> str:
        texts = {
            'uz': f'Bahongiz saqlandi: {self._stars(rating)}',
            'ru': f'Оценка сохранена: {self._stars(rating)}',
            'en': f'Rating saved: {self._stars(rating)}',
        }
        return texts[locale]

    def _review_followup_text(self, locale: str, rating: int) -> str:
        texts = {
            'uz': f'Rahmat. Baho: <b>{self._stars(rating)}</b>\nAgar xohlasangiz, qisqa izoh ham qoldirishingiz mumkin.',
            'ru': f'Спасибо. Оценка: <b>{self._stars(rating)}</b>\nПри желании можете оставить комментарий.',
            'en': f'Thank you. Rating: <b>{self._stars(rating)}</b>\nIf you want, you can also leave a short comment.',
        }
        return texts[locale]

    @staticmethod
    def _comment_requested_text(locale: str) -> str:
        return {
            'uz': 'Izoh uchun keyingi xabaringizni yuboring',
            'ru': 'Отправьте следующим сообщением ваш комментарий',
            'en': 'Send your next message as a comment',
        }[locale]

    @staticmethod
    def _comment_prompt_text(locale: str) -> str:
        return {
            'uz': '✍️ Izohingizni shu chatga yozib yuboring. U broningizga biriktiriladi.',
            'ru': '✍️ Напишите комментарий в этот чат. Он будет привязан к вашей броне.',
            'en': '✍️ Send your comment in this chat. It will be attached to your booking.',
        }[locale]

    @staticmethod
    def _review_comment_saved_text(locale: str) -> str:
        return {
            'uz': '✅ Izohingiz saqlandi. Fikr bildirganingiz uchun rahmat.',
            'ru': '✅ Комментарий сохранён. Спасибо за отзыв.',
            'en': '✅ Your comment was saved. Thank you for the feedback.',
        }[locale]
