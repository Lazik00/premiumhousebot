from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class TelegramAuthRequest(BaseModel):
    init_data: str = Field(min_length=10, alias='initData')


class AuthUserResponse(BaseModel):
    id: str
    telegram_id: int
    first_name: str
    last_name: str | None
    username: str | None
    photo_url: str | None


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


class UserMeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    telegram_id: int
    first_name: str
    last_name: str | None
    username: str | None
    photo_url: str | None
    status: str
    created_at: datetime
