from typing import Generator

import jwt as pyjwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient
from sqlmodel import Session

from app.core.config import settings
from app.database.database import engine

# JWKS client — busca e cacheia as chaves públicas do frontend
_jwks_client = PyJWKClient(settings.JWKS_URL)

# HTTPBearer extrai o token do header Authorization: Bearer <token>
_security = HTTPBearer()


def get_db() -> Generator[Session, None, None]:
    """Dependency para obter sessão do banco de dados."""
    with Session(engine) as session:
        yield session


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_security),
) -> dict:
    """
    Valida JWT e retorna payload do usuário.
    O token é verificado usando as chaves públicas do JWKS do frontend.
    """
    token = credentials.credentials
    try:
        signing_key = _jwks_client.get_signing_key_from_jwt(token)
        payload = pyjwt.decode(
            token,
            signing_key.key,
            algorithms=[settings.JWT_ALGORITHM],
            audience=settings.JWT_AUDIENCE,
            issuer=settings.JWT_ISSUER,
        )
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token inválido: campo 'sub' ausente",
            )
        return {
            "user_id": user_id,
            "email": payload.get("email"),
            "name": payload.get("name"),
        }
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expirado",
        )
    except pyjwt.InvalidTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token inválido: {str(e)}",
        )


def get_current_user_id(
    current_user: dict = Depends(get_current_user),
) -> str:
    """Dependency de conveniência que retorna apenas o user_id."""
    return current_user["user_id"]
