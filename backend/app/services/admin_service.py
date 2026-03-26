import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.balance import BalanceLedgerEntry, HostBalance
from app.models.booking import Booking, BookingEvent
from app.models.enums import (
    AccountType,
    BookingStatus,
    PaymentProvider,
    PaymentStatus,
    PropertyStatus,
    PropertyType,
    TransactionType,
    UserStatus,
)
from app.models.payment import Payment, PaymentCallback, Refund, Transaction
from app.models.property import Amenity, City, Property, PropertyAmenity, PropertyImage, Region
from app.models.user import Role, User, UserRole
from app.schemas.admin import (
    AdminAmenityOptionResponse,
    AdminBookingDetailResponse,
    AdminBookingEventResponse,
    AdminBookingListResponse,
    AdminBookingPaymentSummaryResponse,
    AdminBookingResponse,
    AdminCityOptionResponse,
    AdminDashboardKPIResponse,
    AdminDashboardResponse,
    AdminHostBalanceDetailResponse,
    AdminHostBalanceListResponse,
    AdminHostBalanceResponse,
    AdminHostOptionResponse,
    AdminLedgerEntryResponse,
    AdminMetaOptionsResponse,
    AdminPaymentCallbackResponse,
    AdminPaymentDetailResponse,
    AdminPaymentListResponse,
    AdminPaymentResponse,
    AdminPropertyCreateRequest,
    AdminPropertyDetailResponse,
    AdminPropertyImageResponse,
    AdminPropertyListResponse,
    AdminPropertyResponse,
    AdminRecentBookingResponse,
    AdminRecentPropertyResponse,
    AdminRefundResponse,
    AdminRegionOptionResponse,
    AdminUserListResponse,
    AdminUserResponse,
    RevenuePointResponse,
    StatusCountResponse,
)


class AdminService:
    async def get_dashboard(self, db: AsyncSession) -> AdminDashboardResponse:
        now = datetime.now(UTC)
        since = now - timedelta(days=6)

        total_bookings = await self._count(db, select(Booking.id).where(Booking.deleted_at.is_(None)))
        active_bookings = await self._count(
            db,
            select(Booking.id).where(
                Booking.deleted_at.is_(None),
                Booking.status.in_([BookingStatus.PENDING_PAYMENT, BookingStatus.CONFIRMED]),
            ),
        )
        active_listings = await self._count(
            db,
            select(Property.id).where(Property.deleted_at.is_(None), Property.status == PropertyStatus.ACTIVE),
        )
        pending_listings = await self._count(
            db,
            select(Property.id).where(Property.deleted_at.is_(None), Property.status == PropertyStatus.PENDING_REVIEW),
        )
        total_users = await self._count(db, select(User.id).where(User.deleted_at.is_(None)))
        total_hosts_result = await db.execute(
            select(func.count(func.distinct(User.id)))
            .join(UserRole, UserRole.user_id == User.id)
            .join(Role, Role.id == UserRole.role_id)
            .where(
                User.deleted_at.is_(None),
                UserRole.deleted_at.is_(None),
                Role.deleted_at.is_(None),
                Role.code == 'host',
            )
        )
        total_hosts = int(total_hosts_result.scalar_one() or 0)
        pending_payments = await self._count(
            db,
            select(Booking.id).where(
                Booking.deleted_at.is_(None),
                Booking.status == BookingStatus.PENDING_PAYMENT,
                Booking.expires_at.is_not(None),
                Booking.expires_at > now,
            ),
        )

        gross_revenue = await self._sum_amount(db, Transaction, Transaction.txn_type == TransactionType.PAYMENT_IN)
        platform_commission = await self._sum_amount(db, Transaction, Transaction.txn_type == TransactionType.COMMISSION)
        host_earnings = await self._sum_amount(db, Transaction, Transaction.txn_type == TransactionType.HOST_EARNING)

        booking_status_rows = await db.execute(
            select(Booking.status, func.count(Booking.id))
            .where(Booking.deleted_at.is_(None))
            .group_by(Booking.status)
            .order_by(Booking.status)
        )
        payment_status_rows = await db.execute(
            select(Payment.status, func.count(Payment.id))
            .where(Payment.deleted_at.is_(None))
            .group_by(Payment.status)
            .order_by(Payment.status)
        )
        revenue_day_bucket = func.date_trunc('day', Transaction.created_at).label('day')
        revenue_rows = await db.execute(
            select(revenue_day_bucket, func.coalesce(func.sum(Transaction.amount), 0))
            .where(
                Transaction.deleted_at.is_(None),
                Transaction.txn_type == TransactionType.PAYMENT_IN,
                Transaction.created_at >= since,
            )
            .group_by(revenue_day_bucket)
            .order_by(revenue_day_bucket)
        )

        recent_booking_rows = await db.execute(
            select(Booking, Property.title, User.first_name, User.last_name)
            .join(Property, Property.id == Booking.property_id)
            .join(User, User.id == Booking.user_id)
            .where(
                Booking.deleted_at.is_(None),
                Property.deleted_at.is_(None),
                User.deleted_at.is_(None),
            )
            .order_by(Booking.created_at.desc())
            .limit(8)
        )
        recent_property_rows = await db.execute(
            select(Property, City.name_uz, User.first_name, User.last_name)
            .join(City, City.id == Property.city_id)
            .join(User, User.id == Property.host_id)
            .where(
                Property.deleted_at.is_(None),
                City.deleted_at.is_(None),
                User.deleted_at.is_(None),
            )
            .order_by(Property.created_at.desc())
            .limit(8)
        )

        revenue_map = {row[0].date(): float(row[1] or 0) for row in revenue_rows.all() if row[0] is not None}
        revenue_series = [
            RevenuePointResponse(day=since.date() + timedelta(days=offset), amount=revenue_map.get(since.date() + timedelta(days=offset), 0.0))
            for offset in range(7)
        ]

        return AdminDashboardResponse(
            kpis=AdminDashboardKPIResponse(
                total_bookings=total_bookings,
                active_bookings=active_bookings,
                active_listings=active_listings,
                pending_listings=pending_listings,
                total_users=total_users,
                total_hosts=total_hosts,
                pending_payments=pending_payments,
                gross_revenue=gross_revenue,
                platform_commission=platform_commission,
                host_earnings=host_earnings,
            ),
            booking_statuses=[StatusCountResponse(status=status.value, count=count) for status, count in booking_status_rows.all()],
            payment_statuses=[StatusCountResponse(status=status.value, count=count) for status, count in payment_status_rows.all()],
            revenue_series=revenue_series,
            recent_bookings=[
                AdminRecentBookingResponse(
                    id=str(booking.id),
                    booking_code=booking.booking_code,
                    status=booking.status.value,
                    total_price=float(booking.total_price),
                    start_date=booking.start_date,
                    end_date=booking.end_date,
                    created_at=booking.created_at,
                    customer_name=self._full_name(first_name, last_name),
                    property_title=property_title,
                )
                for booking, property_title, first_name, last_name in recent_booking_rows.all()
            ],
            recent_properties=[
                AdminRecentPropertyResponse(
                    id=str(property_obj.id),
                    title=property_obj.title,
                    city=city_name,
                    host_name=self._full_name(first_name, last_name),
                    property_type=property_obj.property_type.value,
                    status=property_obj.status.value,
                    created_at=property_obj.created_at,
                    price_per_night=float(property_obj.price_per_night),
                )
                for property_obj, city_name, first_name, last_name in recent_property_rows.all()
            ],
        )

    async def get_meta_options(self, db: AsyncSession) -> AdminMetaOptionsResponse:
        host_rows = await db.execute(
            select(User.id, User.first_name, User.last_name, User.email, User.username)
            .join(UserRole, UserRole.user_id == User.id)
            .join(Role, Role.id == UserRole.role_id)
            .where(
                User.deleted_at.is_(None),
                User.status == UserStatus.ACTIVE,
                UserRole.deleted_at.is_(None),
                Role.deleted_at.is_(None),
                Role.code == 'host',
            )
            .order_by(User.first_name.asc(), User.last_name.asc())
        )
        region_rows = await db.execute(
            select(Region).where(Region.deleted_at.is_(None)).order_by(Region.name_uz.asc())
        )
        city_rows = await db.execute(
            select(City).where(City.deleted_at.is_(None)).order_by(City.name_uz.asc())
        )
        amenity_rows = await db.execute(
            select(Amenity).where(Amenity.deleted_at.is_(None)).order_by(Amenity.name_uz.asc())
        )

        return AdminMetaOptionsResponse(
            hosts=[
                AdminHostOptionResponse(
                    id=str(host_id),
                    label=self._full_name(first_name, last_name),
                    email=email,
                    username=username,
                )
                for host_id, first_name, last_name, email, username in host_rows.all()
            ],
            regions=[AdminRegionOptionResponse(id=str(region.id), name=region.name_uz) for region in region_rows.scalars().all()],
            cities=[AdminCityOptionResponse(id=str(city.id), region_id=str(city.region_id), name=city.name_uz) for city in city_rows.scalars().all()],
            amenities=[
                AdminAmenityOptionResponse(id=str(amenity.id), code=amenity.code, name_uz=amenity.name_uz, icon=amenity.icon)
                for amenity in amenity_rows.scalars().all()
            ],
        )

    async def list_users(
        self,
        db: AsyncSession,
        limit: int,
        offset: int,
        search: str | None = None,
        status: str | None = None,
    ) -> AdminUserListResponse:
        stmt = select(User).where(User.deleted_at.is_(None))
        if search:
            pattern = f'%{search.strip().lower()}%'
            stmt = stmt.where(
                or_(
                    func.lower(User.first_name).like(pattern),
                    func.lower(func.coalesce(User.last_name, '')).like(pattern),
                    func.lower(func.coalesce(User.email, '')).like(pattern),
                    func.lower(func.coalesce(User.username, '')).like(pattern),
                )
            )
        if status:
            stmt = stmt.where(User.status == UserStatus(status))

        total_result = await db.execute(select(func.count()).select_from(stmt.order_by(None).subquery()))
        total = int(total_result.scalar_one() or 0)
        rows = await db.execute(stmt.order_by(User.created_at.desc()).limit(limit).offset(offset))
        users = list(rows.scalars().all())

        roles_map = await self._load_role_map(db, [user.id for user in users])
        booking_count_map = await self._load_booking_count_map(db, [user.id for user in users])

        return AdminUserListResponse(
            items=[
                self._user_to_response(user, roles_map.get(user.id, []), booking_count_map.get(user.id, 0))
                for user in users
            ],
            total=total,
            limit=limit,
            offset=offset,
        )

    async def update_user_status(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        status: UserStatus,
        acting_user_id: uuid.UUID,
    ) -> User:
        if user_id == acting_user_id:
            raise ValueError('You cannot change your own status')

        result = await db.execute(select(User).where(User.id == user_id, User.deleted_at.is_(None)))
        user = result.scalar_one_or_none()
        if user is None:
            raise ValueError('User not found')

        user.status = status
        await db.commit()
        await db.refresh(user)
        return user

    async def list_properties(
        self,
        db: AsyncSession,
        limit: int,
        offset: int,
        search: str | None = None,
        status: str | None = None,
        property_type: str | None = None,
    ) -> AdminPropertyListResponse:
        stmt = self._admin_property_base_query()
        if search:
            pattern = f'%{search.strip().lower()}%'
            stmt = stmt.where(
                or_(
                    func.lower(Property.title).like(pattern),
                    func.lower(Property.address).like(pattern),
                    func.lower(City.name_uz).like(pattern),
                )
            )
        if status:
            stmt = stmt.where(Property.status == PropertyStatus(status))
        if property_type:
            stmt = stmt.where(Property.property_type == PropertyType(property_type))

        total_result = await db.execute(select(func.count()).select_from(stmt.order_by(None).subquery()))
        total = int(total_result.scalar_one() or 0)
        rows = await db.execute(stmt.order_by(Property.created_at.desc()).limit(limit).offset(offset))

        return AdminPropertyListResponse(
            items=[self._property_row_to_response(*row) for row in rows.all()],
            total=total,
            limit=limit,
            offset=offset,
        )

    async def get_property_detail(self, db: AsyncSession, property_id: uuid.UUID) -> AdminPropertyDetailResponse:
        row = await self._load_admin_property_row(db, property_id)
        if row is None:
            raise ValueError('Property not found')
        property_obj, city_obj, region_obj, host_obj = row
        images = await self._load_property_images(db, property_id)
        amenities = await self._load_property_amenities(db, property_id)
        return AdminPropertyDetailResponse(
            id=str(property_obj.id),
            host_id=str(property_obj.host_id),
            host_name=self._full_name(host_obj.first_name, host_obj.last_name),
            title=property_obj.title,
            description=property_obj.description,
            address=property_obj.address,
            region_id=str(region_obj.id),
            region=region_obj.name_uz,
            city_id=str(city_obj.id),
            city=city_obj.name_uz,
            latitude=float(property_obj.latitude),
            longitude=float(property_obj.longitude),
            property_type=property_obj.property_type.value,
            capacity=int(property_obj.capacity),
            rooms=int(property_obj.rooms),
            bathrooms=int(property_obj.bathrooms),
            price_per_night=float(property_obj.price_per_night),
            currency=property_obj.currency,
            cancellation_policy=property_obj.cancellation_policy,
            house_rules=property_obj.house_rules,
            status=property_obj.status.value,
            average_rating=float(property_obj.average_rating),
            review_count=int(property_obj.review_count),
            images=images,
            amenities=amenities,
            created_at=property_obj.created_at,
            updated_at=property_obj.updated_at,
        )

    async def create_property(
        self,
        db: AsyncSession,
        payload: AdminPropertyCreateRequest,
    ) -> AdminPropertyDetailResponse:
        host, region, city, _amenities = await self._validate_property_references(
            db=db,
            host_id=uuid.UUID(payload.host_id),
            region_id=uuid.UUID(payload.region_id),
            city_id=uuid.UUID(payload.city_id),
            amenity_ids=payload.amenity_ids,
        )
        property_obj = Property(
            host_id=host.id,
            region_id=region.id,
            city_id=city.id,
            title=payload.title.strip(),
            description=payload.description.strip(),
            address=payload.address.strip(),
            latitude=payload.latitude,
            longitude=payload.longitude,
            property_type=PropertyType(payload.property_type),
            capacity=payload.capacity,
            rooms=payload.rooms,
            bathrooms=payload.bathrooms,
            price_per_night=payload.price_per_night,
            currency=payload.currency.upper(),
            cleaning_fee=0,
            service_fee=0,
            cancellation_policy=payload.cancellation_policy.strip() if payload.cancellation_policy else None,
            house_rules=payload.house_rules.strip() if payload.house_rules else None,
            status=PropertyStatus(payload.status),
        )
        db.add(property_obj)
        await db.flush()
        await self._replace_property_relations(db, property_obj.id, payload.amenity_ids, payload.images)
        await db.commit()
        return await self.get_property_detail(db, property_obj.id)

    async def update_property(
        self,
        db: AsyncSession,
        property_id: uuid.UUID,
        payload: AdminPropertyCreateRequest,
    ) -> AdminPropertyDetailResponse:
        result = await db.execute(select(Property).where(Property.id == property_id, Property.deleted_at.is_(None)))
        property_obj = result.scalar_one_or_none()
        if property_obj is None:
            raise ValueError('Property not found')

        host, region, city, _amenities = await self._validate_property_references(
            db=db,
            host_id=uuid.UUID(payload.host_id),
            region_id=uuid.UUID(payload.region_id),
            city_id=uuid.UUID(payload.city_id),
            amenity_ids=payload.amenity_ids,
        )
        property_obj.host_id = host.id
        property_obj.region_id = region.id
        property_obj.city_id = city.id
        property_obj.title = payload.title.strip()
        property_obj.description = payload.description.strip()
        property_obj.address = payload.address.strip()
        property_obj.latitude = payload.latitude
        property_obj.longitude = payload.longitude
        property_obj.property_type = PropertyType(payload.property_type)
        property_obj.capacity = payload.capacity
        property_obj.rooms = payload.rooms
        property_obj.bathrooms = payload.bathrooms
        property_obj.price_per_night = payload.price_per_night
        property_obj.currency = payload.currency.upper()
        property_obj.cancellation_policy = payload.cancellation_policy.strip() if payload.cancellation_policy else None
        property_obj.house_rules = payload.house_rules.strip() if payload.house_rules else None
        property_obj.status = PropertyStatus(payload.status)

        await self._replace_property_relations(db, property_obj.id, payload.amenity_ids, payload.images)
        await db.commit()
        return await self.get_property_detail(db, property_id)

    async def update_property_status(
        self,
        db: AsyncSession,
        property_id: uuid.UUID,
        status: PropertyStatus,
    ) -> Property:
        result = await db.execute(select(Property).where(Property.id == property_id, Property.deleted_at.is_(None)))
        property_obj = result.scalar_one_or_none()
        if property_obj is None:
            raise ValueError('Property not found')

        property_obj.status = status
        await db.commit()
        await db.refresh(property_obj)
        return property_obj

    async def list_bookings(
        self,
        db: AsyncSession,
        limit: int,
        offset: int,
        search: str | None = None,
        status: str | None = None,
    ) -> AdminBookingListResponse:
        stmt = (
            select(Booking, Property.title, User.first_name, User.last_name)
            .join(Property, Property.id == Booking.property_id)
            .join(User, User.id == Booking.user_id)
            .where(
                Booking.deleted_at.is_(None),
                Property.deleted_at.is_(None),
                User.deleted_at.is_(None),
            )
        )
        if search:
            pattern = f'%{search.strip().lower()}%'
            stmt = stmt.where(
                or_(
                    func.lower(Booking.booking_code).like(pattern),
                    func.lower(Property.title).like(pattern),
                    func.lower(User.first_name).like(pattern),
                    func.lower(func.coalesce(User.last_name, '')).like(pattern),
                )
            )
        if status:
            stmt = stmt.where(Booking.status == BookingStatus(status))

        total_result = await db.execute(select(func.count()).select_from(stmt.order_by(None).subquery()))
        total = int(total_result.scalar_one() or 0)
        rows = await db.execute(stmt.order_by(Booking.created_at.desc()).limit(limit).offset(offset))
        items = rows.all()
        booking_ids = [booking.id for booking, *_ in items]
        latest_payments = await self._load_latest_payments(db, booking_ids)

        return AdminBookingListResponse(
            items=[
                AdminBookingResponse(
                    id=str(booking.id),
                    booking_code=booking.booking_code,
                    status=booking.status.value,
                    start_date=booking.start_date,
                    end_date=booking.end_date,
                    total_nights=booking.total_nights,
                    guests_total=booking.guests_total,
                    total_price=float(booking.total_price),
                    currency='UZS',
                    expires_at=booking.expires_at,
                    confirmed_at=booking.confirmed_at,
                    created_at=booking.created_at,
                    customer_name=self._full_name(first_name, last_name),
                    property_title=property_title,
                    payment_provider=latest_payments.get(booking.id).provider.value if latest_payments.get(booking.id) else None,
                    payment_status=latest_payments.get(booking.id).status.value if latest_payments.get(booking.id) else None,
                )
                for booking, property_title, first_name, last_name in items
            ],
            total=total,
            limit=limit,
            offset=offset,
        )

    async def get_booking_detail(self, db: AsyncSession, booking_id: uuid.UUID) -> AdminBookingDetailResponse:
        result = await db.execute(
            select(Booking, Property, City, Region, User)
            .join(Property, Property.id == Booking.property_id)
            .join(City, City.id == Property.city_id)
            .join(Region, Region.id == Property.region_id)
            .join(User, User.id == Booking.user_id)
            .where(
                Booking.id == booking_id,
                Booking.deleted_at.is_(None),
                Property.deleted_at.is_(None),
                City.deleted_at.is_(None),
                Region.deleted_at.is_(None),
                User.deleted_at.is_(None),
            )
        )
        row = result.one_or_none()
        if row is None:
            raise ValueError('Booking not found')

        booking, property_obj, city_obj, region_obj, user_obj, *_ = row
        host_result = await db.execute(
            select(User).where(User.id == property_obj.host_id, User.deleted_at.is_(None))
        )
        host_obj = host_result.scalar_one_or_none()
        if host_obj is None:
            raise ValueError('Host not found for property')
        events = await self._load_booking_events(db, booking_id)
        payments = await self._load_booking_payments(db, booking_id)
        roles_map = await self._load_role_map(db, [user_obj.id])
        booking_count_map = await self._load_booking_count_map(db, [user_obj.id])

        return AdminBookingDetailResponse(
            id=str(booking.id),
            booking_code=booking.booking_code,
            status=booking.status.value,
            start_date=booking.start_date,
            end_date=booking.end_date,
            total_nights=booking.total_nights,
            guests_total=booking.guests_total,
            guests_adults_men=booking.guests_adults_men,
            guests_adults_women=booking.guests_adults_women,
            guests_children=booking.guests_children,
            total_price=float(booking.total_price),
            currency='UZS',
            expires_at=booking.expires_at,
            confirmed_at=booking.confirmed_at,
            cancelled_at=booking.cancelled_at,
            cancel_reason=booking.cancel_reason,
            created_at=booking.created_at,
            customer=self._user_to_response(user_obj, roles_map.get(user_obj.id, []), booking_count_map.get(user_obj.id, 0)),
            property=self._property_row_to_response(property_obj, city_obj.name_uz, region_obj.name_uz, host_obj.first_name, host_obj.last_name),
            payments=[
                AdminBookingPaymentSummaryResponse(
                    id=str(payment.id),
                    provider=payment.provider.value,
                    status=payment.status.value,
                    amount=float(payment.amount),
                    currency=payment.currency,
                    payment_url=payment.payment_url,
                    provider_payment_id=payment.provider_payment_id,
                    created_at=payment.created_at,
                    paid_at=payment.paid_at,
                )
                for payment in payments
            ],
            events=[
                AdminBookingEventResponse(
                    id=str(event.id),
                    event_type=event.event_type,
                    old_status=event.old_status.value if event.old_status else None,
                    new_status=event.new_status.value if event.new_status else None,
                    event_payload=event.event_payload or {},
                    created_at=event.created_at,
                )
                for event in events
            ],
        )

    async def list_payments(
        self,
        db: AsyncSession,
        limit: int,
        offset: int,
        search: str | None = None,
        status: str | None = None,
        provider: str | None = None,
    ) -> AdminPaymentListResponse:
        stmt = (
            select(Payment, Booking.booking_code, Property.title, User.first_name, User.last_name)
            .join(Booking, Booking.id == Payment.booking_id)
            .join(Property, Property.id == Booking.property_id)
            .join(User, User.id == Booking.user_id)
            .where(
                Payment.deleted_at.is_(None),
                Booking.deleted_at.is_(None),
                Property.deleted_at.is_(None),
                User.deleted_at.is_(None),
            )
        )
        if search:
            pattern = f'%{search.strip().lower()}%'
            stmt = stmt.where(
                or_(
                    func.lower(Booking.booking_code).like(pattern),
                    func.lower(Property.title).like(pattern),
                    func.lower(func.coalesce(Payment.provider_payment_id, '')).like(pattern),
                )
            )
        if status:
            stmt = stmt.where(Payment.status == PaymentStatus(status))
        if provider:
            stmt = stmt.where(Payment.provider == PaymentProvider(provider))

        total_result = await db.execute(select(func.count()).select_from(stmt.order_by(None).subquery()))
        total = int(total_result.scalar_one() or 0)
        rows = await db.execute(stmt.order_by(Payment.created_at.desc()).limit(limit).offset(offset))

        return AdminPaymentListResponse(
            items=[
                AdminPaymentResponse(
                    id=str(payment.id),
                    booking_id=str(payment.booking_id),
                    booking_code=booking_code,
                    provider=payment.provider.value,
                    provider_payment_id=payment.provider_payment_id,
                    status=payment.status.value,
                    amount=float(payment.amount),
                    currency=payment.currency,
                    payment_url=payment.payment_url,
                    customer_name=self._full_name(first_name, last_name),
                    property_title=property_title,
                    created_at=payment.created_at,
                    paid_at=payment.paid_at,
                )
                for payment, booking_code, property_title, first_name, last_name in rows.all()
            ],
            total=total,
            limit=limit,
            offset=offset,
        )

    async def get_payment_detail(self, db: AsyncSession, payment_id: uuid.UUID) -> AdminPaymentDetailResponse:
        result = await db.execute(
            select(Payment, Booking.booking_code, Property.title, User.first_name, User.last_name, User.email)
            .join(Booking, Booking.id == Payment.booking_id)
            .join(Property, Property.id == Booking.property_id)
            .join(User, User.id == Booking.user_id)
            .where(
                Payment.id == payment_id,
                Payment.deleted_at.is_(None),
                Booking.deleted_at.is_(None),
                Property.deleted_at.is_(None),
                User.deleted_at.is_(None),
            )
        )
        row = result.one_or_none()
        if row is None:
            raise ValueError('Payment not found')
        payment, booking_code, property_title, first_name, last_name, email = row
        callbacks = await self._load_payment_callbacks(db, payment_id)
        refunds = await self._load_payment_refunds(db, payment_id)
        return AdminPaymentDetailResponse(
            id=str(payment.id),
            booking_id=str(payment.booking_id),
            booking_code=booking_code,
            provider=payment.provider.value,
            provider_payment_id=payment.provider_payment_id,
            status=payment.status.value,
            amount=float(payment.amount),
            currency=payment.currency,
            payment_url=payment.payment_url,
            raw_request=payment.raw_request or {},
            raw_response=payment.raw_response or {},
            customer_name=self._full_name(first_name, last_name),
            customer_email=email,
            property_title=property_title,
            created_at=payment.created_at,
            paid_at=payment.paid_at,
            failed_at=payment.failed_at,
            callbacks=[
                AdminPaymentCallbackResponse(
                    id=str(callback.id),
                    provider_event_id=callback.provider_event_id,
                    signature=callback.signature,
                    is_valid=callback.is_valid,
                    processed_at=callback.processed_at,
                    created_at=callback.created_at,
                    payload=callback.payload or {},
                )
                for callback in callbacks
            ],
            refunds=[
                AdminRefundResponse(
                    id=str(refund.id),
                    amount=float(refund.amount),
                    status=refund.status.value,
                    reason=refund.reason,
                    provider_refund_id=refund.provider_refund_id,
                    processed_at=refund.processed_at,
                    created_at=refund.created_at,
                )
                for refund in refunds
            ],
        )

    async def list_host_balances(
        self,
        db: AsyncSession,
        limit: int,
        offset: int,
        search: str | None = None,
    ) -> AdminHostBalanceListResponse:
        stmt = (
            select(User, HostBalance)
            .join(UserRole, UserRole.user_id == User.id)
            .join(Role, Role.id == UserRole.role_id)
            .outerjoin(
                HostBalance,
                and_(
                    HostBalance.host_id == User.id,
                    HostBalance.currency == 'UZS',
                    HostBalance.deleted_at.is_(None),
                ),
            )
            .where(
                User.deleted_at.is_(None),
                UserRole.deleted_at.is_(None),
                Role.deleted_at.is_(None),
                Role.code == 'host',
            )
        )
        if search:
            pattern = f'%{search.strip().lower()}%'
            stmt = stmt.where(
                or_(
                    func.lower(User.first_name).like(pattern),
                    func.lower(func.coalesce(User.last_name, '')).like(pattern),
                    func.lower(func.coalesce(User.email, '')).like(pattern),
                )
            )
        total_result = await db.execute(
            select(func.count(func.distinct(User.id)))
            .select_from(User)
            .join(UserRole, UserRole.user_id == User.id)
            .join(Role, Role.id == UserRole.role_id)
            .where(
                User.deleted_at.is_(None),
                UserRole.deleted_at.is_(None),
                Role.deleted_at.is_(None),
                Role.code == 'host',
                *(
                    [
                        or_(
                            func.lower(User.first_name).like(f'%{search.strip().lower()}%'),
                            func.lower(func.coalesce(User.last_name, '')).like(f'%{search.strip().lower()}%'),
                            func.lower(func.coalesce(User.email, '')).like(f'%{search.strip().lower()}%'),
                        )
                    ]
                    if search
                    else []
                ),
            )
        )
        total = int(total_result.scalar_one() or 0)
        rows = await db.execute(stmt.order_by(User.created_at.desc()).limit(limit).offset(offset))

        return AdminHostBalanceListResponse(
            items=[self._host_balance_to_response(user_obj, balance_obj) for user_obj, balance_obj in rows.all()],
            total=total,
            limit=limit,
            offset=offset,
        )

    async def get_host_balance_detail(self, db: AsyncSession, host_id: uuid.UUID) -> AdminHostBalanceDetailResponse:
        user_result = await db.execute(
            select(User)
            .join(UserRole, UserRole.user_id == User.id)
            .join(Role, Role.id == UserRole.role_id)
            .where(
                User.id == host_id,
                User.deleted_at.is_(None),
                UserRole.deleted_at.is_(None),
                Role.deleted_at.is_(None),
                Role.code == 'host',
            )
        )
        user_obj = user_result.scalar_one_or_none()
        if user_obj is None:
            raise ValueError('Host not found')

        balance_result = await db.execute(
            select(HostBalance)
            .where(
                HostBalance.host_id == host_id,
                HostBalance.currency == 'UZS',
                HostBalance.deleted_at.is_(None),
            )
        )
        balance_obj = balance_result.scalar_one_or_none()
        ledger_entries = []
        if balance_obj is not None:
            ledger_rows = await db.execute(
                select(BalanceLedgerEntry)
                .where(
                    BalanceLedgerEntry.account_type == AccountType.HOST,
                    BalanceLedgerEntry.account_id == balance_obj.id,
                    BalanceLedgerEntry.deleted_at.is_(None),
                )
                .order_by(BalanceLedgerEntry.created_at.desc())
                .limit(100)
            )
            ledger_entries = [
                AdminLedgerEntryResponse(
                    id=str(entry.id),
                    direction=entry.direction.value,
                    amount=float(entry.amount),
                    currency=entry.currency,
                    description=entry.description,
                    reference_type=entry.reference_type,
                    reference_id=entry.reference_id,
                    created_at=entry.created_at,
                )
                for entry in ledger_rows.scalars().all()
            ]

        return AdminHostBalanceDetailResponse(
            host_id=str(user_obj.id),
            host_name=self._full_name(user_obj.first_name, user_obj.last_name),
            email=user_obj.email,
            currency='UZS',
            available_amount=float(balance_obj.available_amount) if balance_obj else 0.0,
            pending_amount=float(balance_obj.pending_amount) if balance_obj else 0.0,
            total_earned_amount=float(balance_obj.total_earned_amount) if balance_obj else 0.0,
            total_paid_out_amount=float(balance_obj.total_paid_out_amount) if balance_obj else 0.0,
            updated_at=balance_obj.updated_at if balance_obj else None,
            ledger_entries=ledger_entries,
        )

    async def _validate_property_references(
        self,
        db: AsyncSession,
        *,
        host_id: uuid.UUID,
        region_id: uuid.UUID,
        city_id: uuid.UUID,
        amenity_ids: list[str],
    ) -> tuple[User, Region, City, list[Amenity]]:
        host_result = await db.execute(
            select(User)
            .join(UserRole, UserRole.user_id == User.id)
            .join(Role, Role.id == UserRole.role_id)
            .where(
                User.id == host_id,
                User.deleted_at.is_(None),
                User.status == UserStatus.ACTIVE,
                UserRole.deleted_at.is_(None),
                Role.deleted_at.is_(None),
                Role.code == 'host',
            )
        )
        host = host_result.scalar_one_or_none()
        if host is None:
            raise ValueError('Host not found')

        region_result = await db.execute(select(Region).where(Region.id == region_id, Region.deleted_at.is_(None)))
        region = region_result.scalar_one_or_none()
        if region is None:
            raise ValueError('Region not found')

        city_result = await db.execute(
            select(City).where(City.id == city_id, City.region_id == region_id, City.deleted_at.is_(None))
        )
        city = city_result.scalar_one_or_none()
        if city is None:
            raise ValueError('City not found for selected region')

        parsed_amenity_ids = [uuid.UUID(item) for item in amenity_ids]
        amenities: list[Amenity] = []
        if parsed_amenity_ids:
            amenity_rows = await db.execute(
                select(Amenity).where(Amenity.id.in_(parsed_amenity_ids), Amenity.deleted_at.is_(None))
            )
            amenities = list(amenity_rows.scalars().all())
            if len(amenities) != len(parsed_amenity_ids):
                raise ValueError('Some amenities were not found')

        return host, region, city, amenities

    async def _replace_property_relations(
        self,
        db: AsyncSession,
        property_id: uuid.UUID,
        amenity_ids: list[str],
        images: list,
    ) -> None:
        now = datetime.now(UTC)
        existing_amenities = await db.execute(
            select(PropertyAmenity).where(PropertyAmenity.property_id == property_id, PropertyAmenity.deleted_at.is_(None))
        )
        for item in existing_amenities.scalars().all():
            item.deleted_at = now

        existing_images = await db.execute(
            select(PropertyImage).where(PropertyImage.property_id == property_id, PropertyImage.deleted_at.is_(None))
        )
        for image in existing_images.scalars().all():
            image.deleted_at = now

        for amenity_id in amenity_ids:
            db.add(PropertyAmenity(property_id=property_id, amenity_id=uuid.UUID(amenity_id)))

        normalized_images = list(images)
        if normalized_images and not any(image.is_cover for image in normalized_images):
            normalized_images[0].is_cover = True

        for index, image in enumerate(normalized_images, start=1):
            db.add(
                PropertyImage(
                    property_id=property_id,
                    object_key=(image.object_key or image.image_url).strip(),
                    image_url=image.image_url.strip(),
                    is_cover=bool(image.is_cover),
                    sort_order=image.sort_order or index,
                )
            )
        await db.flush()

    def _admin_property_base_query(self):
        return (
            select(Property, City.name_uz, Region.name_uz, User.first_name, User.last_name)
            .join(City, City.id == Property.city_id)
            .join(Region, Region.id == Property.region_id)
            .join(User, User.id == Property.host_id)
            .where(
                Property.deleted_at.is_(None),
                City.deleted_at.is_(None),
                Region.deleted_at.is_(None),
                User.deleted_at.is_(None),
            )
        )

    async def _load_admin_property_row(self, db: AsyncSession, property_id: uuid.UUID):
        result = await db.execute(
            select(Property, City, Region, User)
            .join(City, City.id == Property.city_id)
            .join(Region, Region.id == Property.region_id)
            .join(User, User.id == Property.host_id)
            .where(
                Property.id == property_id,
                Property.deleted_at.is_(None),
                City.deleted_at.is_(None),
                Region.deleted_at.is_(None),
                User.deleted_at.is_(None),
            )
        )
        return result.one_or_none()

    async def _load_property_images(self, db: AsyncSession, property_id: uuid.UUID) -> list[AdminPropertyImageResponse]:
        rows = await db.execute(
            select(PropertyImage)
            .where(PropertyImage.property_id == property_id, PropertyImage.deleted_at.is_(None))
            .order_by(PropertyImage.sort_order.asc())
        )
        return [
            AdminPropertyImageResponse(
                id=str(image.id),
                image_url=image.image_url,
                object_key=image.object_key,
                is_cover=image.is_cover,
                sort_order=image.sort_order,
            )
            for image in rows.scalars().all()
        ]

    async def _load_property_amenities(self, db: AsyncSession, property_id: uuid.UUID) -> list[AdminAmenityOptionResponse]:
        rows = await db.execute(
            select(Amenity)
            .join(PropertyAmenity, PropertyAmenity.amenity_id == Amenity.id)
            .where(
                PropertyAmenity.property_id == property_id,
                PropertyAmenity.deleted_at.is_(None),
                Amenity.deleted_at.is_(None),
            )
            .order_by(Amenity.name_uz.asc())
        )
        return [
            AdminAmenityOptionResponse(id=str(amenity.id), code=amenity.code, name_uz=amenity.name_uz, icon=amenity.icon)
            for amenity in rows.scalars().all()
        ]

    async def _load_booking_events(self, db: AsyncSession, booking_id: uuid.UUID) -> list[BookingEvent]:
        rows = await db.execute(
            select(BookingEvent)
            .where(BookingEvent.booking_id == booking_id, BookingEvent.deleted_at.is_(None))
            .order_by(BookingEvent.created_at.desc())
        )
        return list(rows.scalars().all())

    async def _load_booking_payments(self, db: AsyncSession, booking_id: uuid.UUID) -> list[Payment]:
        rows = await db.execute(
            select(Payment)
            .where(Payment.booking_id == booking_id, Payment.deleted_at.is_(None))
            .order_by(Payment.created_at.desc())
        )
        return list(rows.scalars().all())

    async def _load_payment_callbacks(self, db: AsyncSession, payment_id: uuid.UUID) -> list[PaymentCallback]:
        rows = await db.execute(
            select(PaymentCallback)
            .where(PaymentCallback.payment_id == payment_id, PaymentCallback.deleted_at.is_(None))
            .order_by(PaymentCallback.created_at.desc())
        )
        return list(rows.scalars().all())

    async def _load_payment_refunds(self, db: AsyncSession, payment_id: uuid.UUID) -> list[Refund]:
        rows = await db.execute(
            select(Refund)
            .where(Refund.payment_id == payment_id, Refund.deleted_at.is_(None))
            .order_by(Refund.created_at.desc())
        )
        return list(rows.scalars().all())

    async def _load_role_map(self, db: AsyncSession, user_ids: list[uuid.UUID]) -> dict[uuid.UUID, list[str]]:
        if not user_ids:
            return {}
        rows = await db.execute(
            select(UserRole.user_id, Role.code)
            .join(Role, Role.id == UserRole.role_id)
            .where(
                UserRole.user_id.in_(user_ids),
                UserRole.deleted_at.is_(None),
                Role.deleted_at.is_(None),
            )
        )
        role_map: dict[uuid.UUID, list[str]] = {user_id: [] for user_id in user_ids}
        for user_id, code in rows.all():
            role_map.setdefault(user_id, []).append(code)
        for codes in role_map.values():
            codes.sort()
        return role_map

    async def _load_booking_count_map(self, db: AsyncSession, user_ids: list[uuid.UUID]) -> dict[uuid.UUID, int]:
        if not user_ids:
            return {}
        rows = await db.execute(
            select(Booking.user_id, func.count(Booking.id))
            .where(Booking.user_id.in_(user_ids), Booking.deleted_at.is_(None))
            .group_by(Booking.user_id)
        )
        return {user_id: count for user_id, count in rows.all()}

    async def _load_latest_payments(self, db: AsyncSession, booking_ids: list[uuid.UUID]) -> dict[uuid.UUID, Payment]:
        if not booking_ids:
            return {}
        subquery = (
            select(Payment.booking_id, func.max(Payment.created_at).label('latest_created_at'))
            .where(Payment.deleted_at.is_(None), Payment.booking_id.in_(booking_ids))
            .group_by(Payment.booking_id)
            .subquery()
        )
        rows = await db.execute(
            select(Payment)
            .join(
                subquery,
                and_(
                    Payment.booking_id == subquery.c.booking_id,
                    Payment.created_at == subquery.c.latest_created_at,
                ),
            )
        )
        payments = rows.scalars().all()
        return {payment.booking_id: payment for payment in payments}

    async def _count(self, db: AsyncSession, stmt) -> int:
        result = await db.execute(select(func.count()).select_from(stmt.subquery()))
        return int(result.scalar_one() or 0)

    async def _sum_amount(self, db: AsyncSession, model, *conditions) -> float:
        result = await db.execute(select(func.coalesce(func.sum(model.amount), 0)).where(model.deleted_at.is_(None), *conditions))
        return float(result.scalar_one() or 0)

    def _user_to_response(self, user: User, roles: list[str], total_bookings: int) -> AdminUserResponse:
        return AdminUserResponse(
            id=str(user.id),
            first_name=user.first_name,
            last_name=user.last_name,
            username=user.username,
            email=user.email,
            phone=user.phone,
            telegram_id=user.telegram_id,
            status=user.status.value,
            roles=roles,
            total_bookings=total_bookings,
            created_at=user.created_at,
            last_login_at=user.last_login_at,
        )

    def _property_row_to_response(
        self,
        property_obj: Property,
        city_name: str,
        region_name: str,
        host_first_name: str,
        host_last_name: str | None,
    ) -> AdminPropertyResponse:
        return AdminPropertyResponse(
            id=str(property_obj.id),
            title=property_obj.title,
            city=city_name,
            region=region_name,
            host_name=self._full_name(host_first_name, host_last_name),
            property_type=property_obj.property_type.value,
            status=property_obj.status.value,
            capacity=int(property_obj.capacity),
            price_per_night=float(property_obj.price_per_night),
            average_rating=float(property_obj.average_rating),
            review_count=int(property_obj.review_count),
            created_at=property_obj.created_at,
        )

    def _host_balance_to_response(self, user_obj: User, balance_obj: HostBalance | None) -> AdminHostBalanceResponse:
        return AdminHostBalanceResponse(
            id=str(balance_obj.id) if balance_obj else None,
            host_id=str(user_obj.id),
            host_name=self._full_name(user_obj.first_name, user_obj.last_name),
            email=user_obj.email,
            currency='UZS',
            available_amount=float(balance_obj.available_amount) if balance_obj else 0.0,
            pending_amount=float(balance_obj.pending_amount) if balance_obj else 0.0,
            total_earned_amount=float(balance_obj.total_earned_amount) if balance_obj else 0.0,
            total_paid_out_amount=float(balance_obj.total_paid_out_amount) if balance_obj else 0.0,
            updated_at=balance_obj.updated_at if balance_obj else None,
        )

    @staticmethod
    def _full_name(first_name: str | None, last_name: str | None) -> str:
        parts = [part for part in [first_name, last_name] if part]
        return ' '.join(parts) if parts else 'Noma\'lum foydalanuvchi'
