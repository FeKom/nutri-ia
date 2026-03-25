from typing import Optional, List
from sqlmodel import Field, SQLModel, Relationship, Column, String
from sqlalchemy import Index, Enum as SQLEnum
from pgvector.sqlalchemy import Vector
from decimal import Decimal
from uuid import UUID
import enum

from app.models.base import TimestampMixin, UUIDMixin


class FoodSource(str, enum.Enum):
    """Source of food data"""
    USDA = "USDA"
    TACO = "TACO"
    CUSTOM = "CUSTOM"


class Food(UUIDMixin, TimestampMixin, SQLModel, table=True):
    """
    Food items table
    Stores basic information about foods from various sources
    """
    __tablename__ = "foods"

    # Basic Information
    name: str = Field(max_length=255, nullable=False, index=True)
    name_normalized: str = Field(
        max_length=255,
        nullable=False,
        unique=True,
        index=True,
        description="Normalized name for case-insensitive searching"
    )
    category: Optional[str] = Field(default=None, max_length=50, index=True)

    # Serving Information
    serving_size_g: Decimal = Field(
        default=100,
        ge=0,
        decimal_places=2,
        description="Default serving size in grams"
    )
    serving_unit: str = Field(
        default="g",
        max_length=20,
        description="Unit of measurement (g, ml, cup, etc)"
    )

    # Caloric Information
    calorie_per_100g: Optional[Decimal] = Field(
        default=None,
        ge=0,
        decimal_places=2,
        description="Calories per 100g"
    )

    # Source and Verification
    usda_id: Optional[str] = Field(
        default=None,
        max_length=50,
        unique=True,
        index=True,
        description="USDA FoodData Central ID"
    )
    source: FoodSource = Field(
        sa_column=Column(SQLEnum(FoodSource), nullable=False, default=FoodSource.CUSTOM)
    )
    is_verified: bool = Field(default=False, description="Whether the food data has been verified")

    # Vector Embedding for Semantic Search
    embedding: Optional[List[float]] = Field(
        default=None,
        sa_column=Column(Vector(384), nullable=True),
        description="Vector embedding for semantic search (384 dimensions for all-MiniLM-L6-v2)"
    )

    # Relationships
    nutrients: Optional["FoodNutrient"] = Relationship(back_populates="food")

    __table_args__ = (
        Index("idx_food_name_normalized", "name_normalized"),
        Index("idx_food_category", "category"),
        Index("idx_food_source", "source"),
    )


class FoodNutrient(UUIDMixin, TimestampMixin, SQLModel, table=True):
    """
    Food nutrients table
    Stores detailed nutritional information per 100g of food
    """
    __tablename__ = "food_nutrients"

    # Foreign Key
    food_id: UUID = Field(foreign_key="foods.id", nullable=False, index=True)

    # Macronutrients (per 100g)
    calories_100g: Optional[Decimal] = Field(default=None, ge=0, decimal_places=2)
    protein_g_100g: Optional[Decimal] = Field(default=None, ge=0, decimal_places=2)
    carbs_g_100g: Optional[Decimal] = Field(default=None, ge=0, decimal_places=2)
    fat_g_100g: Optional[Decimal] = Field(default=None, ge=0, decimal_places=2)

    # Fat Details (per 100g)
    saturated_fat_g_100g: Optional[Decimal] = Field(default=None, ge=0, decimal_places=2)

    # Carbohydrate Details (per 100g)
    fiber_g_100g: Optional[Decimal] = Field(default=None, ge=0, decimal_places=2)
    sugar_g_100g: Optional[Decimal] = Field(default=None, ge=0, decimal_places=2)

    # Minerals (per 100g)
    sodium_mg_100g: Optional[Decimal] = Field(default=None, ge=0, decimal_places=2)
    calcium_mg_100g: Optional[Decimal] = Field(default=None, ge=0, decimal_places=2)
    iron_mg_100g: Optional[Decimal] = Field(default=None, ge=0, decimal_places=2)

    # Vitamins (per 100g)
    vitamin_c_mg_100g: Optional[Decimal] = Field(default=None, ge=0, decimal_places=2)

    # Relationships
    food: Optional[Food] = Relationship(back_populates="nutrients")

    __table_args__ = (
        Index("idx_food_nutrient_food_id", "food_id"),
    )
