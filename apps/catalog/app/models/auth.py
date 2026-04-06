from sqlmodel import Field, SQLModel

from app.models.base import TimestampMixin, UUIDMixin


class User(UUIDMixin, TimestampMixin, SQLModel, table=True):
    __tablename__ = "users"  # type: ignore[assignment]

    username: str = Field(max_length=100, nullable=False, unique=True, index=True)
    name: str = Field(max_length=100, nullable=False)
    hashed_password: str = Field(nullable=False)
