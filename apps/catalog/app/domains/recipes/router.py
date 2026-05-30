from typing import Annotated, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session

from app.api.dependencies import get_db
from app.domains.recipes.exceptions import RecipeNotFoundError
from app.domains.recipes.repository import SQLModelRecipeRepository
from app.schemas.recipe import (
    RecipeCreate,
    RecipeListResponse,
    RecipeResponse,
    RecipeSearchRequest,
    RecipeSearchResponse,
    RecipeSimpleResponse,
    RecipeUpdate,
)

router = APIRouter()


def _get_repo(session: Session = Depends(get_db)) -> SQLModelRecipeRepository:
    return SQLModelRecipeRepository(session)


_Repo = Annotated[SQLModelRecipeRepository, Depends(_get_repo)]


@router.get("", response_model=RecipeListResponse)
async def list_recipes(
    repo: _Repo,
    category: Optional[str] = Query(None),
    difficulty: Optional[str] = Query(None),
    max_prep_time: Optional[int] = Query(None, ge=0),
    max_calories: Optional[int] = Query(None, ge=0),
    min_protein: Optional[float] = Query(None, ge=0),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> RecipeListResponse:
    offset = (page - 1) * page_size
    recipes, total = repo.list_all(
        category,
        difficulty,
        max_prep_time,
        max_calories,
        min_protein,
        page_size,
        offset,
    )
    return RecipeListResponse(
        recipes=[RecipeSimpleResponse.model_validate(r) for r in recipes],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("/search", response_model=RecipeSearchResponse)
async def search_recipes(
    request: RecipeSearchRequest, repo: _Repo
) -> RecipeSearchResponse:
    if request.query:
        recipes, total = repo.search(
            request.query,
            request.category,
            request.difficulty,
            request.max_prep_time,
            request.max_calories,
            request.min_protein,
            request.limit,
            request.offset,
        )
    else:
        recipes, total = repo.list_all(
            request.category,
            request.difficulty,
            request.max_prep_time,
            request.max_calories,
            request.min_protein,
            request.limit,
            request.offset,
        )
    return RecipeSearchResponse(
        success=True,
        recipes=[RecipeSimpleResponse.model_validate(r) for r in recipes],
        total=total,
        limit=request.limit,
        offset=request.offset,
    )


@router.get("/{recipe_id}", response_model=RecipeResponse)
async def get_recipe(recipe_id: UUID, repo: _Repo) -> RecipeResponse:
    recipe = repo.get_by_id(recipe_id)
    if not recipe:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(RecipeNotFoundError(recipe_id)),
        )
    return RecipeResponse.model_validate(recipe)


@router.post("", response_model=RecipeResponse, status_code=status.HTTP_201_CREATED)
async def create_recipe(data: RecipeCreate, repo: _Repo) -> RecipeResponse:
    return RecipeResponse.model_validate(repo.create(data))


@router.put("/{recipe_id}", response_model=RecipeResponse)
async def update_recipe(
    recipe_id: UUID, data: RecipeUpdate, repo: _Repo
) -> RecipeResponse:
    recipe = repo.update(recipe_id, data)
    if not recipe:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(RecipeNotFoundError(recipe_id)),
        )
    return RecipeResponse.model_validate(recipe)


@router.delete("/{recipe_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_recipe(recipe_id: UUID, repo: _Repo) -> None:
    if not repo.delete(recipe_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(RecipeNotFoundError(recipe_id)),
        )
