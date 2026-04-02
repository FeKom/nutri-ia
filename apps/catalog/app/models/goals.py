from datetime import date as date_type
from typing import Optional
from uuid import UUID

from sqlmodel import Field, SQLModel

from app.models.base import TimestampMixin, UUIDMixin


class Goal(UUIDMixin, TimestampMixin, SQLModel, table=True):
    """User personal goals (metas)."""

    __tablename__ = "goals"  # type: ignore[assignment]

    user_id: UUID = Field(nullable=False, index=True)
    title: str = Field(nullable=False, max_length=255)
    description: Optional[str] = Field(default=None, max_length=500)
    target_value: float = Field(nullable=False)
    current_value: float = Field(nullable=False)
    unit: str = Field(nullable=False, max_length=50)
    category: str = Field(nullable=False, max_length=50)  # peso | nutricao | atividade
    deadline: Optional[date_type] = Field(default=None)
