from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from app.api.dependencies import get_current_user_id, get_db
from app.domains.recommendations.repository import SQLModelRecommendationRepository
from app.models.user import UserProfile
from app.schemas.recommendation import (
    RecommendationRequest,
    RecommendationResponse,
    RecommendedFoodItem,
    UserFiltersResponse,
)

router = APIRouter()


def _get_repo(session: Session = Depends(get_db)) -> SQLModelRecommendationRepository:
    return SQLModelRecommendationRepository(session)


_Repo = Annotated[SQLModelRecommendationRepository, Depends(_get_repo)]


def _get_profile(user_id: UUID, session: Session) -> UserProfile:
    profile = session.exec(
        select(UserProfile).where(UserProfile.user_id == user_id)
    ).first()
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User profile {user_id} not found",
        )
    return profile


def _to_item(food) -> RecommendedFoodItem:
    n = getattr(food, "nutrients", None)
    return RecommendedFoodItem(
        id=food.id,
        name=food.name,
        category=food.category,
        serving_size_g=food.serving_size_g,
        serving_unit=food.serving_unit,
        calorie_per_100g=food.calorie_per_100g,
        source=food.source,
        is_verified=food.is_verified,
        protein_g_100g=n.protein_g_100g if n else None,
        carbs_g_100g=n.carbs_g_100g if n else None,
        fat_g_100g=n.fat_g_100g if n else None,
    )


@router.post("", response_model=RecommendationResponse)
async def get_recommendations(
    request: RecommendationRequest,
    repo: _Repo,
    session: Session = Depends(get_db),
    current_user_id: str = Depends(get_current_user_id),
) -> RecommendationResponse:
    profile = _get_profile(UUID(current_user_id), session)
    if request.category:
        foods = repo.get_by_category(profile, request.category, request.limit)
    else:
        foods = repo.recommend_foods(profile, request.limit)
    return RecommendationResponse(
        success=True,
        foods=[_to_item(f) for f in foods],
        count=len(foods),
        filters_applied={
            "dietary_restrictions": profile.dietary_restrictions or [],
            "allergies": profile.allergies or [],
            "disliked_foods": profile.disliked_foods or [],
        },
    )


@router.get("/filters", response_model=UserFiltersResponse)
async def get_user_filters(
    session: Session = Depends(get_db),
    current_user_id: str = Depends(get_current_user_id),
) -> UserFiltersResponse:
    profile = _get_profile(UUID(current_user_id), session)
    return UserFiltersResponse(
        user_id=UUID(current_user_id),
        dietary_restrictions=profile.dietary_restrictions or [],
        allergies=profile.allergies or [],
        disliked_foods=profile.disliked_foods or [],
    )
