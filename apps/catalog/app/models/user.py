from enum import Enum
from typing import List, Optional
from uuid import UUID

from sqlmodel import JSON, Column, Field, SQLModel

from app.models.base import TimestampMixin, UUIDMixin


class DietGoal(str, Enum):
    WEIGHT_LOSS = "weight_loss"
    WEIGHT_GAIN = "weight_gain"
    MAINTAIN = "maintain"


class ActivityLevel(str, Enum):
    SEDENTARY = "sedentary"
    LIGHT = "light"
    MODERATE = "moderate"
    ACTIVE = "active"
    VERY_ACTIVE = "very_active"


class UserProfile(UUIDMixin, TimestampMixin, SQLModel, table=True):
    """
    User profile table
    Stores user-specific information such as dietary goals and preferences
    """

    __tablename__ = "user_profiles"  # type: ignore[assignment]

    user_id: UUID = Field(nullable=False, index=True, unique=True)
    name: str = Field(max_length=100, nullable=False)
    age: Optional[int] = Field(default=None, ge=0, le=120)
    weight_kg: Optional[float] = Field(default=None, ge=0)
    height_cm: Optional[float] = Field(default=None, ge=0)
    gender: Optional[str] = Field(default=None, max_length=20)
    activity_level: Optional[ActivityLevel] = Field(default=None, nullable=False)
    diet_goal: Optional[DietGoal] = Field(default=None, nullable=False)
    dietary_restrictions: Optional[List[str]] = Field(
        default=[], sa_column=Column(JSON)
    )
    allergies: Optional[List[str]] = Field(default=[], sa_column=Column(JSON))
    disliked_foods: Optional[List[str]] = Field(default=[], sa_column=Column(JSON))
    preferred_cuisines: Optional[List[str]] = Field(default=[], sa_column=Column(JSON))


class MealPlan(UUIDMixin, TimestampMixin, SQLModel, table=True):
    """
    Meal plan table
    Stores meal plans associated with users
    """

    __tablename__ = "meal_plans"  # type: ignore[assignment]

    user_id: UUID = Field(nullable=False, index=True)
    plan_name: str = Field(max_length=100, nullable=False)
    description: str = Field(default=None, max_length=500)
    daily_calories: float
    daily_protein_g: float
    daily_fat_g: float
    daily_carbs_g: float
    created_by: str = Field(
        default="system"
    )  # System = AI generated, user = user created
    meals: List[dict] = Field(
        sa_column=Column(JSON), default=[]
    )  # Each meal can be represented as a dictionary
