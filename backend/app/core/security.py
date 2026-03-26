import hashlib
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

ALGORITHM = 'HS256'
pwd_context = CryptContext(schemes=['pbkdf2_sha256'], deprecated='auto')


class TokenError(ValueError):
    pass


def create_access_token(subject: str, expires_delta: timedelta | None = None) -> str:
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=settings.access_token_expire_minutes))
    payload = {'sub': subject, 'exp': expire, 'type': 'access'}
    return jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM)


def create_refresh_token(subject: str, expires_delta: timedelta | None = None) -> str:
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(days=settings.refresh_token_expire_days))
    payload = {'sub': subject, 'exp': expire, 'type': 'refresh'}
    return jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
    except JWTError as exc:
        raise TokenError('Invalid token') from exc


def extract_subject(token: str, expected_type: str) -> str:
    payload = decode_token(token)
    token_type = payload.get('type')
    subject = payload.get('sub')
    if token_type != expected_type or not subject:
        raise TokenError('Invalid token payload')
    return str(subject)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode('utf-8')).hexdigest()


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str | None) -> bool:
    if not password_hash:
        return False
    return pwd_context.verify(password, password_hash)
