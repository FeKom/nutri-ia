from datetime import datetime
from typing import List
from uuid import UUID, uuid4

from sqlmodel import Column, Field, JSON, SQLModel


class Recipe(SQLModel, table=True):
    """Recipe model for storing recipe information."""

    __tablename__ = "recipes"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    name: str = Field(max_length=255, index=True)
    description: str = Field(max_length=1000)
    category: str = Field(max_length=50, index=True)  # cafe-da-manha, almoco, jantar, lanche
    prep_time_minutes: int
    difficulty: str = Field(max_length=20)  # facil, medio, dificil
    calories: int
    protein_g: float
    carbs_g: float
    fat_g: float
    ingredients: List[str] = Field(sa_column=Column(JSON))
    instructions: str | None = Field(default=None, max_length=5000)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
