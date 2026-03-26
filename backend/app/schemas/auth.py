from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class TelegramAuthRequest(BaseModel):
    init_data: str = Field(min_length=10, alias='initData')


class AuthUserResponse(BaseModel):
    id: str
    telegram_id: int | None
    first_name: str
    last_name: str | None
    username: str | None
    photo_url: str | None
    email: str | None = None
    roles: list[str] = []


class TokenPairResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = 'bearer'
    expires_in: int


class TelegramAuthResponse(TokenPairResponse):
    user: AuthUserResponse


class RefreshTokenRequest(BaseModel):
    refresh_token: str = Field(min_length=20)


class RefreshTokenResponse(TokenPairResponse):
    pass


class LogoutRequest(BaseModel):
    refresh_token: str = Field(min_length=20)


class AdminLoginRequest(BaseModel):
    email: str = Field(min_length=5, max_length=255)
    password: str = Field(min_length=8, max_length=255)


class AdminLoginResponse(TokenPairResponse):
    user: AuthUserResponse


class UserMeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    telegram_id: int | None
    first_name: str
    last_name: str | None
    username: str | None
    photo_url: str | None
    email: str | None = None
    status: str
    roles: list[str] = []
    created_at: datetime
