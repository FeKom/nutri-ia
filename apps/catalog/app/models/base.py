from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlmodel import Field, SQLModel


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class TimestampMixin(SQLModel):
    """Mixin for created_at and updated_at timestamps"""
    created_at: datetime = Field(default_factory=utc_now, nullable=False)
    updated_at: datetime = Field(default_factory=utc_now, nullable=False)


class UUIDMixin(SQLModel):
    """Mixin for UUID primary key"""
    id: UUID = Field(default_factory=uuid4, primary_key=True, nullable=False)
