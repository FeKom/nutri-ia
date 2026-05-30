from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from app.models.food import FoodSource


class FoodSearchFilters(BaseModel):
    category: Optional[str] = Field(None)
    min_protein: Optional[Decimal] = Field(None, ge=0)
    max_calories: Optional[Decimal] = Field(None, ge=0)
    source: Optional[FoodSource] = None
    verified_only: bool = False


class FoodSimpleResponse(BaseModel):
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


class FoodSearchRequest(BaseModel):
    query: List[str] = Field(..., min_length=1)
    limit: int = Field(default=10, ge=1, le=100)
    filters: Optional[FoodSearchFilters] = None
    min_similarity: float = Field(default=0.0, ge=0.0, le=1.0)

    @field_validator("query")
    @classmethod
    def query_not_empty(cls, v: List[str]) -> List[str]:
        cleaned = [s.strip() for s in v if s.strip()]
        if not cleaned:
            raise ValueError("Query cannot be empty")
        return cleaned


class FoodSearchResponse(BaseModel):
    success: bool = True
    foods: List[FoodSimpleResponse]
    count: int


class SimilarFoodRequest(BaseModel):
    food_id: UUID
    limit: int = Field(default=10, ge=1, le=50)
    same_category: bool = False


class SimilarFoodItem(BaseModel):
    id: UUID
    name: str
    category: Optional[str]
    calorie_per_100g: Optional[Decimal]
    protein_g_100g: Optional[Decimal]
    carbs_g_100g: Optional[Decimal]
    fat_g_100g: Optional[Decimal]
    fiber_g_100g: Optional[Decimal]
    similarity_score: float
    source: FoodSource
    is_verified: bool

    class Config:
        from_attributes = True


class SimilarFoodsResponse(BaseModel):
    success: bool = True
    reference_food: Optional[FoodSimpleResponse] = None
    similar_foods: List[SimilarFoodItem]
    count: int


class FoodResolveRequest(BaseModel):
    queries: List[str] = Field(..., min_length=1, max_length=50)
    min_similarity: float = Field(default=0.4, ge=0.0, le=1.0)
    limit_per_query: int = Field(default=1, ge=1, le=5)

    @field_validator("queries")
    @classmethod
    def queries_not_empty(cls, v: List[str]) -> List[str]:
        cleaned = [q.strip() for q in v if q.strip()]
        if not cleaned:
            raise ValueError("At least one non-empty query is required")
        return cleaned


class ResolvedFoodItem(BaseModel):
    query: str
    food_id: UUID
    name: str
    category: Optional[str]
    calorie_per_100g: Optional[Decimal]
    protein_g_100g: Optional[Decimal] = None
    carbs_g_100g: Optional[Decimal] = None
    fat_g_100g: Optional[Decimal] = None
    similarity_score: float
    source: FoodSource
    is_verified: bool


class FoodResolveResponse(BaseModel):
    success: bool = True
    resolved: List[ResolvedFoodItem]
    unresolved: List[str]
    resolved_count: int
    unresolved_count: int
