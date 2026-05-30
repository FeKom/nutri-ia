from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

from app.api.dependencies import get_db
from app.domains.food_catalog.exceptions import FoodNotFoundError
from app.domains.food_catalog.repository import SQLModelFoodRepository
from app.domains.food_catalog.schemas import (
    FoodResolveRequest,
    FoodResolveResponse,
    FoodSearchRequest,
    FoodSearchResponse,
    FoodSimpleResponse,
    ResolvedFoodItem,
    SimilarFoodItem,
    SimilarFoodRequest,
    SimilarFoodsResponse,
)
from app.domains.food_catalog.service import FoodService

router = APIRouter()


def _get_service(session: Session = Depends(get_db)) -> FoodService:
    return FoodService(SQLModelFoodRepository(session))


_Svc = Annotated[FoodService, Depends(_get_service)]


def _simple(food) -> FoodSimpleResponse:
    n = getattr(food, "nutrients", None)
    return FoodSimpleResponse(
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


def _similar_item(food, score: float) -> SimilarFoodItem:
    n = getattr(food, "nutrients", None)
    return SimilarFoodItem(
        id=food.id,
        name=food.name,
        category=food.category,
        calorie_per_100g=food.calorie_per_100g,
        similarity_score=score,
        source=food.source,
        is_verified=food.is_verified,
        protein_g_100g=n.protein_g_100g if n else None,
        carbs_g_100g=n.carbs_g_100g if n else None,
        fat_g_100g=n.fat_g_100g if n else None,
        fiber_g_100g=n.fiber_g_100g if n else None,
    )


@router.post("/search", response_model=FoodSearchResponse)
async def search_foods(request: FoodSearchRequest, svc: _Svc) -> FoodSearchResponse:
    foods = svc.search(request.query, request.limit, request.filters)
    return FoodSearchResponse(
        success=True, foods=[_simple(f) for f in foods], count=len(foods)
    )


@router.get("/{food_id}", response_model=FoodSimpleResponse)
async def get_food(food_id: UUID, svc: _Svc) -> FoodSimpleResponse:
    try:
        return _simple(svc.get_food_with_nutrients(food_id))
    except FoodNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/search-by-embedding", response_model=SimilarFoodsResponse)
async def search_by_embedding(
    request: FoodSearchRequest, svc: _Svc
) -> SimilarFoodsResponse:
    results = svc.search_by_embedding(
        request.query, request.limit, request.filters, request.min_similarity
    )
    return SimilarFoodsResponse(
        success=True,
        reference_food=None,
        similar_foods=[_similar_item(f, s) for f, s in results],
        count=len(results),
    )


@router.post("/resolve", response_model=FoodResolveResponse)
async def resolve_foods(request: FoodResolveRequest, svc: _Svc) -> FoodResolveResponse:
    results = svc.resolve_batch(
        request.queries, request.min_similarity, request.limit_per_query
    )
    resolved, unresolved = [], []
    for qtext, matches in results.items():
        if matches:
            for food, score in matches:
                n = getattr(food, "nutrients", None)
                resolved.append(
                    ResolvedFoodItem(
                        query=qtext,
                        food_id=food.id,
                        name=food.name,
                        category=food.category,
                        calorie_per_100g=food.calorie_per_100g,
                        similarity_score=score,
                        source=food.source,
                        is_verified=food.is_verified,
                        protein_g_100g=n.protein_g_100g if n else None,
                        carbs_g_100g=n.carbs_g_100g if n else None,
                        fat_g_100g=n.fat_g_100g if n else None,
                    )
                )
        else:
            unresolved.append(qtext)
    return FoodResolveResponse(
        success=True,
        resolved=resolved,
        unresolved=unresolved,
        resolved_count=len(resolved),
        unresolved_count=len(unresolved),
    )


@router.post("/similar", response_model=SimilarFoodsResponse)
async def find_similar(request: SimilarFoodRequest, svc: _Svc) -> SimilarFoodsResponse:
    try:
        ref = svc.get_food_with_nutrients(request.food_id)
        similar = svc.find_similar(
            request.food_id, request.limit, request.same_category
        )
    except FoodNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    return SimilarFoodsResponse(
        success=True,
        reference_food=_simple(ref),
        similar_foods=[_similar_item(f, s) for f, s in similar],
        count=len(similar),
    )
