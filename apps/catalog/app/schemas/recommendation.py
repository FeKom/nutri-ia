from typing import Optional, List
from pydantic import BaseModel, Field
from decimal import Decimal
from uuid import UUID

from app.models.food import FoodSource


class RecommendationRequest(BaseModel):
    """Request schema for food recommendations"""
    user_id: UUID = Field(..., description="UUID of the user profile")
    limit: int = Field(default=10, ge=1, le=100, description="Maximum number of recommendations (default: 10 for AI-friendly responses)")
    category: Optional[str] = Field(None, description="Filter by food category")


class RecommendedFoodItem(BaseModel):
    """A recommended food item"""
    id: UUID
    name: str
    category: Optional[str]
    serving_size_g: Decimal
    serving_unit: str
    calorie_per_100g: Optional[Decimal]
    source: FoodSource
    is_verified: bool
    protein_g_100g: Optional[Decimal] = None
    carbs_g_100g: Optional[Decimal] = None
    fat_g_100g: Optional[Decimal] = None

    class Config:
        from_attributes = True


class RecommendationResponse(BaseModel):
    """Response schema for food recommendations"""
    success: bool = True
    foods: List[RecommendedFoodItem]
    count: int = Field(..., description="Number of recommendations returned")
    filters_applied: dict = Field(
        default_factory=dict,
        description="Summary of filters applied based on user profile"
    )


class UserFiltersResponse(BaseModel):
    """Response showing what filters are applied for a user"""
    user_id: UUID
    dietary_restrictions: List[str] = []
    allergies: List[str] = []
    disliked_foods: List[str] = []
