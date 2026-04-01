from datetime import date as date_type
from typing import Optional
from uuid import UUID

from sqlmodel import Field, SQLModel

from app.models.base import TimestampMixin, UUIDMixin


class ActivityLog(UUIDMixin, TimestampMixin, SQLModel, table=True):
    """Physical activity log (atividades)."""

    __tablename__ = "activity_logs"  # type: ignore[assignment]

    user_id: UUID = Field(nullable=False, index=True)
    type: str = Field(nullable=False, max_length=100)
    duration_minutes: int = Field(nullable=False, gt=0)
    calories_burned: int = Field(nullable=False, ge=0)
    date: date_type = Field(nullable=False, index=True)
    notes: Optional[str] = Field(default=None, max_length=500)
