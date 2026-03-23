from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class RecipeBase(BaseModel):
    """Base recipe schema."""

    name: str = Field(..., max_length=255)
    description: str = Field(..., max_length=1000)
    category: str = Field(..., pattern="^(cafe-da-manha|almoco|jantar|lanche)$")
    prep_time_minutes: int = Field(..., gt=0)
    difficulty: str = Field(..., pattern="^(facil|medio|dificil)$")
    calories: int = Field(..., ge=0)
    protein_g: float = Field(..., ge=0)
    carbs_g: float = Field(..., ge=0)
    fat_g: float = Field(..., ge=0)
    ingredients: List[str] = Field(..., min_items=1)
    instructions: Optional[str] = Field(None, max_length=5000)


class RecipeCreate(RecipeBase):
    """Schema for creating a recipe."""

    pass


class RecipeResponse(RecipeBase):
    """Schema for recipe response."""

    id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class RecipeSearchRequest(BaseModel):
    """Schema for searching recipes."""

    category: Optional[str] = Field(None, pattern="^(cafe-da-manha|almoco|jantar|lanche)$")
    difficulty: Optional[str] = Field(None, pattern="^(facil|medio|dificil)$")
    max_calories: Optional[int] = Field(None, ge=0)
    min_protein: Optional[float] = Field(None, ge=0)
    limit: int = Field(20, ge=1, le=100)


class RecipeSearchResponse(BaseModel):
    """Schema for recipe search response."""

    success: bool = True
    recipes: List[RecipeResponse]
    count: int
