from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field


# ========== Meal Plan Schemas ==========


class MealPlanCreate(BaseModel):
    """Schema for creating a meal plan"""

    plan_name: str = Field(..., min_length=1, max_length=100, description="Name of the meal plan")
    description: Optional[str] = Field(None, max_length=500, description="Description of the plan")
    daily_calories: float = Field(..., gt=0, description="Daily calorie target")
    daily_protein_g: float = Field(..., gt=0, description="Daily protein target in grams")
    daily_fat_g: float = Field(..., gt=0, description="Daily fat target in grams")
    daily_carbs_g: float = Field(..., gt=0, description="Daily carbs target in grams")
    created_by: str = Field(default="user", description="Created by user or ai")
    meals: Optional[List[dict]] = Field(default=[], description="Array of meals")


class MealPlanUpdate(BaseModel):
    """Schema for updating a meal plan"""

    plan_name: Optional[str] = Field(None, min_length=1, max_length=100, description="Name of the meal plan")
    description: Optional[str] = Field(None, max_length=500, description="Description of the plan")
    daily_calories: Optional[float] = Field(None, gt=0, description="Daily calorie target")
    daily_protein_g: Optional[float] = Field(None, gt=0, description="Daily protein target in grams")
    daily_fat_g: Optional[float] = Field(None, gt=0, description="Daily fat target in grams")
    daily_carbs_g: Optional[float] = Field(None, gt=0, description="Daily carbs target in grams")
    meals: Optional[List[dict]] = Field(None, description="Array of meals")


class MealPlanResponse(BaseModel):
    """Response schema for a meal plan"""

    id: UUID
    user_id: UUID
    plan_name: str
    description: Optional[str]
    daily_calories: float
    daily_protein_g: float
    daily_fat_g: float
    daily_carbs_g: float
    created_by: str
    meals: List[dict]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class MealPlanListResponse(BaseModel):
    """Response schema for listing meal plans"""

    plans: List[MealPlanResponse]
    total: int
    page: int
    page_size: int
