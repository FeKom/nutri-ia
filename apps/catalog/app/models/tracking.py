from datetime import date as date_type
from datetime import datetime
from enum import Enum
from typing import List, Optional
from uuid import UUID

from sqlmodel import JSON, Column, Field, SQLModel

from app.models.base import TimestampMixin, UUIDMixin


class MealType(str, Enum):
    BREAKFAST = "breakfast"
    LUNCH = "lunch"
    DINNER = "dinner"
    SNACK = "snack"


class MealLog(UUIDMixin, TimestampMixin, SQLModel, table=True):
    """
    Meal log table
    Stores individual meals consumed by users with nutritional totals
    """

    __tablename__ = "meal_logs"  # type: ignore[assignment]

    user_id: UUID = Field(nullable=False, index=True)

    # Data e hora
    consumed_at: datetime = Field(nullable=False, index=True)
    meal_type: MealType = Field(nullable=False)

    # Alimentos consumidos - lista de dicionários com food_id e quantity_g
    # Formato: [{"food_id": "uuid-string", "quantity_g": 150.0, "name": "Arroz branco"}]
    foods: List[dict] = Field(sa_column=Column(JSON), default=[])

    # Totais calculados
    total_calories: float = Field(default=0.0)
    total_protein_g: float = Field(default=0.0)
    total_carbs_g: float = Field(default=0.0)
    total_fat_g: float = Field(default=0.0)
    total_fiber_g: Optional[float] = Field(default=None)
    total_sodium_mg: Optional[float] = Field(default=None)

    # Notas do usuário
    notes: Optional[str] = Field(default=None, max_length=500)


class DailyStats(UUIDMixin, TimestampMixin, SQLModel, table=True):
    """
    Daily stats table
    Aggregated nutritional statistics per user per day
    """

    __tablename__ = "daily_stats"  # type: ignore[assignment]

    user_id: UUID = Field(nullable=False, index=True)
    date: date_type = Field(nullable=False, index=True)

    # Totais do dia
    total_calories: float = Field(default=0.0)
    total_protein_g: float = Field(default=0.0)
    total_carbs_g: float = Field(default=0.0)
    total_fat_g: float = Field(default=0.0)
    total_fiber_g: Optional[float] = Field(default=None)
    total_sodium_mg: Optional[float] = Field(default=None)

    # Metas do dia (copiadas do perfil do usuário)
    target_calories: Optional[float] = Field(default=None)
    target_protein_g: Optional[float] = Field(default=None)
    target_carbs_g: Optional[float] = Field(default=None)
    target_fat_g: Optional[float] = Field(default=None)

    # Número de refeições registradas
    num_meals: int = Field(default=0)
