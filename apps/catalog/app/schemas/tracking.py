from datetime import date as date_type, datetime
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from app.models.tracking import MealType


# ========== Meal Log Schemas ==========


class FoodLogItem(BaseModel):
    """Schema for a food item in a meal log"""

    food_id: UUID = Field(..., description="UUID of the food item")
    quantity_g: Decimal = Field(..., gt=0, description="Quantity in grams")
    name: Optional[str] = Field(None, description="Food name for display")

    @field_validator("quantity_g")
    @classmethod
    def quantity_positive(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("Quantity must be greater than 0")
        return v


class MealLogRequest(BaseModel):
    """Request schema for logging a meal"""

    user_id: UUID = Field(..., description="UUID of the user")
    meal_type: MealType = Field(..., description="Type of meal")
    foods: List[FoodLogItem] = Field(
        ..., min_length=1, description="List of foods consumed"
    )
    consumed_at: Optional[datetime] = Field(
        None, description="When the meal was consumed (defaults to now)"
    )
    notes: Optional[str] = Field(None, max_length=500, description="User notes")

    @field_validator("foods")
    @classmethod
    def foods_not_empty(cls, v: List[FoodLogItem]) -> List[FoodLogItem]:
        if not v:
            raise ValueError("At least one food item is required")
        return v


class MealLogUpdate(BaseModel):
    """Schema for updating a meal log (all fields optional)"""

    meal_type: Optional[MealType] = Field(None, description="Type of meal")
    foods: Optional[List[FoodLogItem]] = Field(
        None, min_length=1, description="List of foods consumed"
    )
    consumed_at: Optional[datetime] = Field(
        None, description="When the meal was consumed"
    )
    notes: Optional[str] = Field(None, max_length=500, description="User notes")

    @field_validator("foods")
    @classmethod
    def foods_not_empty(cls, v: Optional[List[FoodLogItem]]) -> Optional[List[FoodLogItem]]:
        if v is not None and not v:
            raise ValueError("Foods list cannot be empty if provided")
        return v


class MealLogResponse(BaseModel):
    """Response schema for a meal log"""

    id: UUID
    user_id: UUID
    consumed_at: datetime
    meal_type: MealType
    foods: List[dict]
    total_calories: float
    total_protein_g: float
    total_carbs_g: float
    total_fat_g: float
    total_fiber_g: Optional[float]
    total_sodium_mg: Optional[float]
    notes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ========== Daily Summary Schemas ==========


class DailySummaryRequest(BaseModel):
    """Request schema for daily summary"""

    user_id: UUID = Field(..., description="UUID of the user")
    date: date_type = Field(..., description="Date to get summary for")


class MealSummary(BaseModel):
    """Summary of a single meal"""

    id: UUID
    meal_type: MealType
    consumed_at: datetime
    total_calories: float
    total_protein_g: float
    total_carbs_g: float
    total_fat_g: float
    num_foods: int
    notes: Optional[str]


class NutritionProgress(BaseModel):
    """Progress towards nutrition goals"""

    calories_pct: float = Field(..., description="Percentage of calorie goal reached")
    protein_pct: float = Field(..., description="Percentage of protein goal reached")
    carbs_pct: float = Field(..., description="Percentage of carbs goal reached")
    fat_pct: float = Field(..., description="Percentage of fat goal reached")


class DailySummaryResponse(BaseModel):
    """Response schema for daily summary"""

    date: date_type
    meals: List[MealSummary]
    totals: dict = Field(..., description="Total nutrition for the day")
    targets: dict = Field(..., description="User's nutrition targets")
    progress: NutritionProgress
    num_meals: int


# ========== Weekly Stats Schemas ==========


class WeeklyStatsRequest(BaseModel):
    """Request schema for weekly stats"""

    user_id: UUID = Field(..., description="UUID of the user")
    days: int = Field(default=7, ge=1, le=30, description="Number of days to include")


class DayStats(BaseModel):
    """Statistics for a single day"""

    date: date_type
    total_calories: float
    total_protein_g: float
    total_carbs_g: float
    total_fat_g: float
    num_meals: int
    target_calories: Optional[float]
    target_protein_g: Optional[float]


class WeeklyStatsResponse(BaseModel):
    """Response schema for weekly stats"""

    user_id: UUID
    stats: List[DayStats]
    averages: dict = Field(..., description="Average nutrition over the period")
    adherence_rate: float = Field(
        ..., description="Percentage of days with logged meals"
    )
