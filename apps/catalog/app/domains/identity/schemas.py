from pydantic import BaseModel

from app.schemas.user import UserProfileCreate, UserProfileResponse, UserProfileUpdate  # noqa: F401


class RegisterRequest(BaseModel):
    username: str
    name: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
