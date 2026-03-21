from pydantic import BaseModel, Field
from uuid import UUID
from typing import Optional, List
from datetime import datetime


class UserProfileCreate(BaseModel):
    """Schema for creating a user profile"""

    user_id: UUID = Field(..., description="UUID of the user")
    name: str = Field(..., min_length=1, max_length=255, description="User's name")
    age: int = Field(..., ge=1, le=120, description="User's age")
    weight_kg: Optional[float] = Field(None, gt=0, description="Weight in kg")
    height_cm: Optional[float] = Field(None, gt=0, description="Height in cm")
    gender: Optional[str] = Field(None, max_length=20, description="Gender (male, female, non_binary)")
    activity_level: Optional[str] = Field(
        "moderate",
        description="Activity level (sedentary, light, moderate, active, very_active)",
    )
    diet_goal: Optional[str] = Field(
        "maintain",
        description="Diet goal (weight_loss, weight_gain, maintain)",
    )
    dietary_restrictions: Optional[List[str]] = Field(
        default_factory=list,
        description="List of dietary restrictions (e.g., vegetarian, vegan)",
    )
    allergies: Optional[List[str]] = Field(
        default_factory=list,
        description="List of food allergies",
    )
    disliked_foods: Optional[List[str]] = Field(
        default_factory=list,
        description="List of disliked foods",
    )
    preferred_cuisines: Optional[List[str]] = Field(
        default_factory=list,
        description="List of preferred cuisines",
    )


class UserProfileUpdate(BaseModel):
    """Schema for updating a user profile (all fields optional)"""

    name: Optional[str] = Field(None, min_length=1, max_length=255, description="User's name")
    age: Optional[int] = Field(None, ge=1, le=120, description="User's age")
    weight_kg: Optional[float] = Field(None, gt=0, description="Weight in kg")
    height_cm: Optional[float] = Field(None, gt=0, description="Height in cm")
    gender: Optional[str] = Field(None, max_length=20, description="Gender")
    activity_level: Optional[str] = Field(
        None,
        description="Activity level (sedentary, light, moderate, active, very_active)",
    )
    diet_goal: Optional[str] = Field(
        None,
        description="Diet goal (weight_loss, weight_gain, maintain)",
    )
    dietary_restrictions: Optional[List[str]] = Field(
        None,
        description="List of dietary restrictions (e.g., vegetarian, vegan)",
    )
    allergies: Optional[List[str]] = Field(
        None,
        description="List of food allergies",
    )
    disliked_foods: Optional[List[str]] = Field(
        None,
        description="List of disliked foods",
    )
    preferred_cuisines: Optional[List[str]] = Field(
        None,
        description="List of preferred cuisines",
    )


class UserProfileResponse(BaseModel):
    """Schema for user profile response"""

    user_id: UUID
    name: str
    age: int
    weight_kg: Optional[float]
    height_cm: Optional[float]
    gender: Optional[str]
    activity_level: str
    diet_goal: str
    dietary_restrictions: List[str]
    allergies: List[str]
    disliked_foods: List[str]
    preferred_cuisines: List[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
