from datetime import datetime, timedelta, timezone
from uuid import UUID

import jwt
from fastapi.templating import Jinja2Templates
from fastapi_csrf_protect import CsrfProtect
from passlib.context import CryptContext
from pydantic_settings import BaseSettings

from app.core.config import settings

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

templates = Jinja2Templates(directory="templates")


class CsrfSettings(BaseSettings):
    secret_key: str = settings.JWT_SECRET_KEY


@CsrfProtect.load_config
def gef_csrf_config():
    return CsrfSettings()


def _to_bcrypt_bytes(password: str) -> bytes:
    """Encode password to UTF-8 and truncate to 72 bytes (bcrypt hard limit)."""
    return password.encode("utf-8")[:72]


def hash_password(password):
    return pwd_context.hash(password[:72])


def verify_password(plain, hashed):
    return pwd_context.verify(plain, hashed)


def create_access_token(user_id: UUID, username: str, name: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    payload = {
        "sub": str(user_id),
        "username": username,
        "name": name,
        "exp": expire,
        "iss": settings.JWT_ISSUER,
        "aud": settings.JWT_AUDIENCE,
    }
    return jwt.encode(
        payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM
    )
