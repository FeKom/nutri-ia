from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from app.models.food import FoodSource

# ========== Food Schemas ==========


class FoodNutrientBase(BaseModel):
    """Base schema for food nutrients"""

    calories_100g: Optional[Decimal] = None
    protein_g_100g: Optional[Decimal] = None
    carbs_g_100g: Optional[Decimal] = None
    fat_g_100g: Optional[Decimal] = None
    saturated_fat_g_100g: Optional[Decimal] = None
    fiber_g_100g: Optional[Decimal] = None
    sugar_g_100g: Optional[Decimal] = None
    sodium_mg_100g: Optional[Decimal] = None
    calcium_mg_100g: Optional[Decimal] = None
    iron_mg_100g: Optional[Decimal] = None
    vitamin_c_mg_100g: Optional[Decimal] = None


class FoodNutrientResponse(FoodNutrientBase):
    """Response schema for food nutrients"""

    id: UUID
    food_id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class FoodBase(BaseModel):
    """Base schema for food"""

    name: str = Field(..., max_length=255)
    category: Optional[str] = Field(None, max_length=50)
    serving_size_g: Decimal = Field(default=100, ge=0)
    serving_unit: str = Field(default="g", max_length=20)
    calorie_per_100g: Optional[Decimal] = Field(None, ge=0)


class FoodResponse(FoodBase):
    """Response schema for food with nutrients"""

    id: UUID
    name_normalized: str
    usda_id: Optional[str] = None
    source: FoodSource
    is_verified: bool
    created_at: datetime
    updated_at: datetime
    nutrients: Optional[FoodNutrientResponse] = None

    class Config:
        from_attributes = True


class FoodSimpleResponse(BaseModel):
    """Simplified food response for search results"""

    id: UUID
    name: str
    category: Optional[str]
    serving_size_g: Decimal
    serving_unit: str
    calorie_per_100g: Optional[Decimal]
    source: FoodSource
    is_verified: bool

    # Include key nutrients for quick reference
    protein_g_100g: Optional[Decimal] = None
    carbs_g_100g: Optional[Decimal] = None
    fat_g_100g: Optional[Decimal] = None

    class Config:
        from_attributes = True


# ========== Search Schemas ==========


class FoodSearchFilters(BaseModel):
    """Filters for food search"""

    category: Optional[str] = Field(None, description="Filter by food category")
    min_protein: Optional[Decimal] = Field(
        None, ge=0, description="Minimum protein in grams per 100g"
    )
    max_calories: Optional[Decimal] = Field(
        None, ge=0, description="Maximum calories per 100g"
    )
    source: Optional[FoodSource] = Field(None, description="Filter by data source")
    verified_only: bool = Field(False, description="Only return verified foods")


class FoodSearchRequest(BaseModel):
    """Request schema for food search"""

    query: str = Field(..., min_length=1, max_length=255, description="Search query")
    limit: int = Field(
        default=10, ge=1, le=100, description="Number of results to return"
    )
    filters: Optional[FoodSearchFilters] = Field(None, description="Optional filters")
    min_similarity: float = Field(
        default=0.0, ge=0.0, le=1.0,
        description="Minimum similarity threshold (0-1). Results below this score are filtered out."
    )

    @field_validator("query")
    @classmethod
    def query_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Query cannot be empty")
        return v.strip()


class FoodSearchResponse(BaseModel):
    """Response schema for food search"""

    success: bool = True
    foods: List[FoodSimpleResponse]
    count: int = Field(..., description="Number of results returned")


# ========== Nutrition Calculation Schemas ==========


class FoodQuantity(BaseModel):
    """Schema for food with quantity for nutrition calculation"""

    food_id: UUID = Field(..., description="UUID of the food item")
    quantity: Decimal = Field(..., gt=0, description="Quantity in grams")

    @field_validator("quantity")
    @classmethod
    def quantity_positive(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("Quantity must be greater than 0")
        return v


class NutritionCalculationRequest(BaseModel):
    """Request schema for nutrition calculation"""

    foods: List[FoodQuantity] = Field(
        ..., min_length=1, description="List of foods with quantities"
    )

    @field_validator("foods")
    @classmethod
    def foods_not_empty(cls, v: List[FoodQuantity]) -> List[FoodQuantity]:
        if not v:
            raise ValueError("At least one food item is required")
        return v


class NutritionTotals(BaseModel):
    """Total nutritional values"""

    calories: Decimal = Field(default=0, description="Total calories")
    protein_g: Decimal = Field(default=0, description="Total protein in grams")
    carbs_g: Decimal = Field(default=0, description="Total carbohydrates in grams")
    fat_g: Decimal = Field(default=0, description="Total fat in grams")
    saturated_fat_g: Decimal = Field(
        default=0, description="Total saturated fat in grams"
    )
    fiber_g: Decimal = Field(default=0, description="Total fiber in grams")
    sugar_g: Decimal = Field(default=0, description="Total sugar in grams")
    sodium_mg: Decimal = Field(default=0, description="Total sodium in milligrams")
    calcium_mg: Decimal = Field(default=0, description="Total calcium in milligrams")
    iron_mg: Decimal = Field(default=0, description="Total iron in milligrams")
    vitamin_c_mg: Decimal = Field(
        default=0, description="Total vitamin C in milligrams"
    )


class NutritionDetail(BaseModel):
    """Detailed nutrition for a single food item"""

    food_id: UUID
    food_name: str
    quantity_g: Decimal
    calories: Decimal
    protein_g: Decimal
    carbs_g: Decimal
    fat_g: Decimal


class NutritionCalculationResponse(BaseModel):
    """Response schema for nutrition calculation"""

    success: bool = True
    total: NutritionTotals
    details: List[NutritionDetail]


# ========== Similar Foods Schemas ==========


class SimilarFoodRequest(BaseModel):
    """Request schema for finding similar foods using vector similarity"""

    food_id: UUID = Field(..., description="UUID of the reference food")
    limit: int = Field(
        default=10, ge=1, le=50, description="Number of similar foods to return"
    )
    same_category: bool = Field(
        default=False, description="Only return foods from same category"
    )


class SimilarFoodItem(BaseModel):
    """A similar food item with similarity score"""

    id: UUID
    name: str
    category: Optional[str]
    calorie_per_100g: Optional[Decimal]
    protein_g_100g: Optional[Decimal]
    carbs_g_100g: Optional[Decimal]
    fat_g_100g: Optional[Decimal]
    fiber_g_100g: Optional[Decimal]
    similarity_score: float = Field(
        ..., description="Similarity score (0-1, higher is more similar)"
    )
    source: FoodSource
    is_verified: bool

    class Config:
        from_attributes = True


class SimilarFoodsResponse(BaseModel):
    """Response schema for similar foods search"""

    success: bool = True
    reference_food: Optional[FoodSimpleResponse] = None
    similar_foods: List[SimilarFoodItem]
    count: int


# ========== Food Resolve Schemas ==========


class FoodResolveRequest(BaseModel):
    """Request schema for batch food name resolution"""

    queries: List[str] = Field(
        ..., min_length=1, max_length=50,
        description="List of food names to resolve (max 50)"
    )
    min_similarity: float = Field(
        default=0.4, ge=0.0, le=1.0,
        description="Minimum similarity threshold (0-1). Foods below this score go to unresolved."
    )
    limit_per_query: int = Field(
        default=1, ge=1, le=5,
        description="Number of top matches to return per query"
    )

    @field_validator("queries")
    @classmethod
    def queries_not_empty(cls, v: List[str]) -> List[str]:
        cleaned = [q.strip() for q in v if q.strip()]
        if not cleaned:
            raise ValueError("At least one non-empty query is required")
        return cleaned


class ResolvedFoodItem(BaseModel):
    """A resolved food item with similarity score"""

    query: str = Field(..., description="Original query string")
    food_id: UUID
    name: str
    category: Optional[str]
    calorie_per_100g: Optional[Decimal]
    protein_g_100g: Optional[Decimal] = None
    carbs_g_100g: Optional[Decimal] = None
    fat_g_100g: Optional[Decimal] = None
    similarity_score: float = Field(
        ..., description="Similarity score (0-1, higher is more similar)"
    )
    source: FoodSource
    is_verified: bool

    class Config:
        from_attributes = True


class FoodResolveResponse(BaseModel):
    """Response schema for batch food resolution"""

    success: bool = True
    resolved: List[ResolvedFoodItem] = Field(
        ..., description="Foods that matched above the similarity threshold"
    )
    unresolved: List[str] = Field(
        ..., description="Query strings that could not be resolved above the threshold"
    )
    resolved_count: int
    unresolved_count: int


# ========== Image Analysis Schemas ==========


class ImageAnalysisRequest(BaseModel):
    """Request schema for food image analysis"""

    image: str = Field(
        ...,
        description="Base64-encoded image (with or without data:image prefix)"
    )
    top_k_per_food: int = Field(
        default=3,
        ge=1,
        le=10,
        description="Number of catalog matches to return per detected food"
    )
    confidence_threshold: float = Field(
        default=0.5,
        ge=0.1,
        le=1.0,
        description="Minimum confidence threshold for DETIC detection (0-1)"
    )

    @field_validator("image")
    @classmethod
    def image_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Image data cannot be empty")
        return v.strip()


class CatalogMatch(BaseModel):
    """A catalog food item matched to a detected food"""

    id: str = Field(..., description="UUID of the food in catalog")
    name: str
    similarity: float = Field(..., description="Similarity score (0-1)")
    category: Optional[str]
    calories_per_100g: Optional[float]
    serving_size_g: float
    serving_unit: str
    source: FoodSource
    is_verified: bool


class DetectedFoodMatch(BaseModel):
    """A detected food with its catalog matches"""

    detected_name: str = Field(..., description="Name of the food detected by DETIC")
    matches: List[CatalogMatch] = Field(
        ..., description="Catalog foods matching this detection"
    )


class ImageAnalysisResponse(BaseModel):
    """Response schema for food image analysis"""

    success: bool = True
    detected_foods: List[str] = Field(
        ..., description="Names of foods detected in the image"
    )
    catalog_matches: List[DetectedFoodMatch] = Field(
        ..., description="Catalog matches for each detected food"
    )
    total_detected: int = Field(..., description="Total number of unique foods detected")
    total_catalog_matches: int = Field(
        ..., description="Total number of catalog matches found"
    )
    message: Optional[str] = Field(
        None, description="Optional message (e.g., when no foods detected)"
    )
