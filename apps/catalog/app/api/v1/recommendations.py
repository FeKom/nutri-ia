from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from app.api.dependencies import get_current_user_id, get_db
from app.models.user import UserProfile
from app.schemas.recommendation import (
    RecommendationRequest,
    RecommendationResponse,
    RecommendedFoodItem,
    UserFiltersResponse,
)
from app.services import recomendation_service

router = APIRouter()


def _get_user_profile(db: Session, user_id: UUID) -> UserProfile:
    """Get user profile or raise 404"""
    profile = db.exec(select(UserProfile).where(UserProfile.user_id == user_id)).first()

    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User profile with ID {user_id} not found",
        )
    return profile


@router.post("", response_model=RecommendationResponse)
async def get_recommendations(
    request: RecommendationRequest,
    db: Session = Depends(get_db),
    current_user_id: str = Depends(get_current_user_id),
) -> RecommendationResponse:
    """
    Get personalized food recommendations for the authenticated user.

    The user_id from the request body is overridden with the authenticated user's ID.
    """
    # Override with authenticated user
    user_uuid = UUID(current_user_id)
    profile = _get_user_profile(db, user_uuid)

    if request.category:
        foods = recomendation_service.get_foods_by_category(
            session=db, profile=profile, category=request.category, limit=request.limit
        )
    else:
        foods = recomendation_service.recommend_foods(
            session=db, profile=profile, limit=request.limit
        )

    recommended_items = []
    for food in foods:
        item_dict = {
            "id": food.id,
            "name": food.name,
            "category": food.category,
            "serving_size_g": food.serving_size_g,
            "serving_unit": food.serving_unit,
            "calorie_per_100g": food.calorie_per_100g,
            "source": food.source,
            "is_verified": food.is_verified,
        }

        if hasattr(food, "nutrients") and food.nutrients:
            item_dict["protein_g_100g"] = food.nutrients.protein_g_100g
            item_dict["carbs_g_100g"] = food.nutrients.carbs_g_100g
            item_dict["fat_g_100g"] = food.nutrients.fat_g_100g

        recommended_items.append(RecommendedFoodItem(**item_dict))

    filters_applied = {
        "dietary_restrictions": profile.dietary_restrictions or [],
        "allergies": profile.allergies or [],
        "disliked_foods": profile.disliked_foods or [],
    }

    return RecommendationResponse(
        success=True,
        foods=recommended_items,
        count=len(recommended_items),
        filters_applied=filters_applied,
    )


@router.get("/filters", response_model=UserFiltersResponse)
async def get_user_filters(
    db: Session = Depends(get_db),
    current_user_id: str = Depends(get_current_user_id),
) -> UserFiltersResponse:
    """
    Get dietary filters for the authenticated user.
    """
    user_uuid = UUID(current_user_id)
    profile = _get_user_profile(db, user_uuid)

    return UserFiltersResponse(
        user_id=user_uuid,
        dietary_restrictions=profile.dietary_restrictions or [],
        allergies=profile.allergies or [],
        disliked_foods=profile.disliked_foods or [],
    )
