# Premium House API Endpoints (v1)

Base path: `/api/v1`

Auth model:

- Access token: JWT (short-lived)
- Refresh token: hashed and stored server-side
- RBAC: enforced via role + permission middleware

## 1. Auth

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | Public | Register by phone/email + password (optional) |
| POST | `/auth/login/password` | Public | Login with email/phone + password |
| POST | `/auth/login/otp/request` | Public | Request OTP for phone/email login |
| POST | `/auth/login/otp/verify` | Public | Verify OTP and issue JWT pair |
| POST | `/auth/refresh` | Refresh token | Rotate token pair |
| POST | `/auth/logout` | Access token | Revoke current refresh token |
| GET | `/auth/me` | Access token | Current user profile and roles |

## 2. Users & RBAC

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/users/{user_id}` | Self/Admin | User details |
| PATCH | `/users/{user_id}` | Self/Admin | Update profile |
| POST | `/users/{user_id}/block` | Admin/SuperAdmin | Block user |
| POST | `/users/{user_id}/unblock` | Admin/SuperAdmin | Unblock user |
| GET | `/admin/roles` | Admin/SuperAdmin | List roles |
| POST | `/admin/users/{user_id}/roles` | SuperAdmin | Assign roles |

## 3. Properties

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/properties` | Public | Search/filter listings |
| GET | `/properties/{property_id}` | Public | Property detail |
| POST | `/properties` | Host | Create property listing |
| PATCH | `/properties/{property_id}` | Host(Admin) | Update property |
| DELETE | `/properties/{property_id}` | Host(Admin) | Soft delete property |
| POST | `/properties/{property_id}/images` | Host | Upload image metadata |
| DELETE | `/properties/{property_id}/images/{image_id}` | Host | Remove image |
| GET | `/properties/{property_id}/calendar` | Public | Availability calendar |
| PUT | `/properties/{property_id}/calendar` | Host | Bulk calendar updates |
| POST | `/admin/properties/{property_id}/approve` | Admin | Approve listing |
| POST | `/admin/properties/{property_id}/block` | Admin | Block listing |

Supported search filters:

- `city`, `region`, `price_min`, `price_max`
- `check_in`, `check_out`
- `guests`, `property_type`, `amenities[]`
- `rating_min`, `sort`, `page`, `page_size`

## 4. Booking

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/bookings/quote` | Customer | Price preview with fees/promo |
| POST | `/bookings` | Customer | Create `pending` booking (hold) |
| GET | `/bookings/{booking_id}` | Customer/Host/Admin | Booking detail |
| GET | `/bookings/me` | Customer | Customer bookings |
| GET | `/host/bookings` | Host | Host bookings |
| POST | `/bookings/{booking_id}/cancel` | Customer/Host/Admin | Cancel booking by policy |
| POST | `/bookings/{booking_id}/complete` | System/Admin | Mark completed after stay |

## 5. Payments

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/payments/preauthorize` | Customer | Start payment authorization |
| POST | `/payments/{payment_id}/capture` | System | Capture authorized amount |
| POST | `/payments/{payment_id}/refund` | Admin | Full/partial refund |
| GET | `/payments/{payment_id}` | Owner/Admin | Payment detail |
| GET | `/transactions` | Admin | Transaction history |
| POST | `/webhooks/payments/click` | Provider | Click callback |
| POST | `/webhooks/payments/payme` | Provider | Payme callback |
| POST | `/webhooks/payments/rahmat` | Provider | Rahmat callback |

## 6. Reviews

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/reviews` | Customer | Review completed booking |
| POST | `/reviews/{review_id}/reply` | Host | Host reply |
| GET | `/properties/{property_id}/reviews` | Public | List reviews |

## 7. Notifications

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/notifications/me` | User | User notifications |
| PATCH | `/notifications/{id}/read` | User | Mark notification read |
| POST | `/admin/notifications/broadcast` | Admin | Broadcast campaign |

## 8. Wishlist

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/wishlists` | Customer | List wishlists |
| POST | `/wishlists` | Customer | Create wishlist |
| POST | `/wishlists/{wishlist_id}/items` | Customer | Add property to wishlist |
| DELETE | `/wishlists/{wishlist_id}/items/{property_id}` | Customer | Remove item |

## 9. Promo & Dynamic Pricing

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/promo/validate` | Customer | Validate promo for booking quote |
| POST | `/admin/promo-codes` | Admin | Create promo code |
| PATCH | `/admin/promo-codes/{id}` | Admin | Update promo code |
| POST | `/host/properties/{id}/pricing-rules` | Host | Set seasonal/dynamic pricing rules |

## 10. Admin Analytics

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/admin/dashboard/summary` | Admin | Bookings/revenue/commission KPIs |
| GET | `/admin/dashboard/revenue` | Admin | Revenue series |
| GET | `/admin/dashboard/commissions` | Admin | Commission metrics |
| GET | `/admin/dashboard/listings` | Admin | Active/inactive listings |
| GET | `/host/reports/income` | Host | Host income report |

## 11. Health & Ops

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/health` | Public | Liveness check |
| GET | `/ready` | Internal | Readiness with DB/Redis checks |
| GET | `/metrics` | Internal | Prometheus metrics |

## 12. Endpoint Security Requirements

- Request idempotency on:
  - `POST /bookings`
  - `POST /payments/preauthorize`
  - provider webhook handlers
- Rate limiting on:
  - login, OTP endpoints
  - booking create and quote endpoints
- Signature verification on all payment webhooks
- Ownership checks:
  - host can access only own properties/bookings
  - customer can access only own bookings/payments
