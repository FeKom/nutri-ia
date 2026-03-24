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


class RecipeUpdate(BaseModel):
    """Schema for updating a recipe (all fields optional)."""

    name: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = Field(None, max_length=1000)
    category: Optional[str] = Field(None, pattern="^(cafe-da-manha|almoco|jantar|lanche)$")
    prep_time_minutes: Optional[int] = Field(None, gt=0)
    difficulty: Optional[str] = Field(None, pattern="^(facil|medio|dificil)$")
    calories: Optional[int] = Field(None, ge=0)
    protein_g: Optional[float] = Field(None, ge=0)
    carbs_g: Optional[float] = Field(None, ge=0)
    fat_g: Optional[float] = Field(None, ge=0)
    ingredients: Optional[List[str]] = Field(None, min_items=1)
    instructions: Optional[str] = Field(None, max_length=5000)


class RecipeSimpleResponse(BaseModel):
    """Simplified recipe response for lists."""

    id: UUID
    name: str
    description: str
    category: str
    prep_time_minutes: int
    difficulty: str
    calories: int
    protein_g: float
    carbs_g: float
    fat_g: float

    class Config:
        from_attributes = True


class RecipeSearchRequest(BaseModel):
    """Schema for searching recipes."""

    query: Optional[str] = Field(None, description="Search query (name, ingredient)")
    category: Optional[str] = Field(None, pattern="^(cafe-da-manha|almoco|jantar|lanche)$")
    difficulty: Optional[str] = Field(None, pattern="^(facil|medio|dificil)$")
    max_prep_time: Optional[int] = Field(None, ge=0, description="Max prep time in minutes")
    max_calories: Optional[int] = Field(None, ge=0)
    min_protein: Optional[float] = Field(None, ge=0)
    limit: int = Field(20, ge=1, le=100)
    offset: int = Field(0, ge=0)


class RecipeSearchResponse(BaseModel):
    """Schema for recipe search response."""

    success: bool = True
    recipes: List[RecipeSimpleResponse]
    total: int
    limit: int
    offset: int


class RecipeListResponse(BaseModel):
    """Schema for listing recipes with pagination."""

    recipes: List[RecipeSimpleResponse]
    total: int
    page: int
    page_size: int
