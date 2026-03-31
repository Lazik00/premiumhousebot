import uuid
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.booking import Booking
from app.models.enums import BookingStatus
from app.models.property import Property
from app.models.review import Review
from app.models.user import User


class ReviewService:
    async def create_or_update_rating_for_telegram_user(
        self,
        db: AsyncSession,
        *,
        booking_id: uuid.UUID,
        telegram_id: int,
        rating: int,
        local_today: date,
    ) -> tuple[Review, Booking, User]:
        if rating < 1 or rating > 5:
            raise ValueError('Rating must be between 1 and 5')

        booking, user = await self._load_completed_booking_for_telegram_user(
            db=db,
            booking_id=booking_id,
            telegram_id=telegram_id,
            local_today=local_today,
        )
        review = await self._get_or_create_review(db=db, booking=booking, user=user, rating=rating)
        review.rating = rating
        review.awaiting_comment = False
        await self._recalculate_property_rating(db=db, property_id=booking.property_id)
        await db.commit()
        await db.refresh(review)
        return review, booking, user

    async def request_comment_for_telegram_user(
        self,
        db: AsyncSession,
        *,
        booking_id: uuid.UUID,
        telegram_id: int,
        local_today: date,
    ) -> tuple[Review, Booking, User]:
        booking, user = await self._load_completed_booking_for_telegram_user(
            db=db,
            booking_id=booking_id,
            telegram_id=telegram_id,
            local_today=local_today,
        )
        review = await self._get_or_create_review(db=db, booking=booking, user=user, rating=5)
        review.awaiting_comment = True
        await db.commit()
        await db.refresh(review)
        return review, booking, user

    async def submit_pending_comment(
        self,
        db: AsyncSession,
        *,
        telegram_id: int,
        comment: str,
    ) -> Review | None:
        clean_comment = comment.strip()
        if not clean_comment:
            return None

        result = await db.execute(
            select(Review)
            .join(User, User.id == Review.user_id)
            .where(
                User.telegram_id == telegram_id,
                User.deleted_at.is_(None),
                Review.awaiting_comment.is_(True),
                Review.deleted_at.is_(None),
            )
            .order_by(Review.updated_at.desc(), Review.created_at.desc())
            .limit(1)
        )
        review = result.scalar_one_or_none()
        if review is None:
            return None

        review.comment = clean_comment
        review.awaiting_comment = False
        await db.commit()
        await db.refresh(review)
        return review

    async def list_property_reviews(
        self,
        db: AsyncSession,
        *,
        property_id: uuid.UUID,
        limit: int = 12,
    ) -> list[tuple[Review, User]]:
        result = await db.execute(
            select(Review, User)
            .join(User, User.id == Review.user_id)
            .where(
                Review.property_id == property_id,
                Review.deleted_at.is_(None),
                User.deleted_at.is_(None),
            )
            .order_by(Review.created_at.desc())
            .limit(limit)
        )
        return list(result.all())

    async def has_review_for_booking(self, db: AsyncSession, *, booking_id: uuid.UUID) -> bool:
        result = await db.execute(
            select(Review.id).where(
                Review.booking_id == booking_id,
                Review.deleted_at.is_(None),
            )
        )
        return result.scalar_one_or_none() is not None

    async def _load_completed_booking_for_telegram_user(
        self,
        db: AsyncSession,
        *,
        booking_id: uuid.UUID,
        telegram_id: int,
        local_today: date,
    ) -> tuple[Booking, User]:
        result = await db.execute(
            select(Booking, User)
            .join(User, User.id == Booking.user_id)
            .where(
                Booking.id == booking_id,
                Booking.deleted_at.is_(None),
                User.telegram_id == telegram_id,
                User.deleted_at.is_(None),
            )
            .with_for_update()
        )
        row = result.one_or_none()
        if row is None:
            raise ValueError('Booking not found')

        booking, user = row
        if booking.status not in {BookingStatus.COMPLETED, BookingStatus.CONFIRMED}:
            raise ValueError('Booking is not ready for review')
        if booking.end_date > local_today:
            raise ValueError('Review is available after the stay is completed')
        return booking, user

    async def _get_or_create_review(
        self,
        db: AsyncSession,
        *,
        booking: Booking,
        user: User,
        rating: int,
    ) -> Review:
        result = await db.execute(
            select(Review).where(
                Review.booking_id == booking.id,
                Review.deleted_at.is_(None),
            )
        )
        review = result.scalar_one_or_none()
        if review is not None:
            return review

        review = Review(
            booking_id=booking.id,
            user_id=user.id,
            property_id=booking.property_id,
            rating=rating,
            awaiting_comment=False,
        )
        db.add(review)
        await db.flush()
        return review

    async def _recalculate_property_rating(self, db: AsyncSession, *, property_id: uuid.UUID) -> None:
        stats = await db.execute(
            select(
                func.coalesce(func.avg(Review.rating), 0),
                func.count(Review.id),
            ).where(
                Review.property_id == property_id,
                Review.deleted_at.is_(None),
            )
        )
        average_rating, review_count = stats.one()
        property_result = await db.execute(
            select(Property).where(
                Property.id == property_id,
                Property.deleted_at.is_(None),
            )
        )
        property_obj = property_result.scalar_one_or_none()
        if property_obj is None:
            return

        property_obj.average_rating = round(float(average_rating or 0), 2)
        property_obj.review_count = int(review_count or 0)
