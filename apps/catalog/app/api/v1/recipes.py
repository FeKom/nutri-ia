from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session

from app.api.dependencies import get_db
from app.schemas.recipe import (
    RecipeCreate,
    RecipeListResponse,
    RecipeResponse,
    RecipeSearchRequest,
    RecipeSearchResponse,
    RecipeSimpleResponse,
    RecipeUpdate,
)
from app.services import recipe_service

router = APIRouter()


@router.post("/search", response_model=RecipeSearchResponse)
async def search_recipes(
    request: RecipeSearchRequest, db: Session = Depends(get_db)
) -> RecipeSearchResponse:
    """
    Search recipes by text query and/or filters

    **Request Body:**
    - `query`: Optional text search (name, description, ingredients)
    - `category`: Filter by category (cafe-da-manha, almoco, jantar, lanche)
    - `difficulty`: Filter by difficulty (facil, medio, dificil)
    - `max_prep_time`: Maximum preparation time in minutes
    - `max_calories`: Maximum calories per serving
    - `min_protein`: Minimum protein in grams
    - `limit`: Maximum number of results (default: 20, max: 100)
    - `offset`: Offset for pagination (default: 0)

    **Response:**
    - `success`: Boolean indicating success
    - `recipes`: Array of recipe objects
    - `total`: Total number of matching recipes
    - `limit`: Limit used
    - `offset`: Offset used
    """
    try:
        if request.query:
            # Text search
            recipes, total = recipe_service.search_recipes(
                session=db,
                query=request.query,
                category=request.category,
                difficulty=request.difficulty,
                max_prep_time=request.max_prep_time,
                max_calories=request.max_calories,
                min_protein=request.min_protein,
                limit=request.limit,
                offset=request.offset,
            )
        else:
            # List with filters
            recipes, total = recipe_service.list_recipes(
                session=db,
                category=request.category,
                difficulty=request.difficulty,
                max_prep_time=request.max_prep_time,
                max_calories=request.max_calories,
                min_protein=request.min_protein,
                limit=request.limit,
                offset=request.offset,
            )

        return RecipeSearchResponse(
            success=True,
            recipes=[RecipeSimpleResponse.model_validate(r) for r in recipes],
            total=total,
            limit=request.limit,
            offset=request.offset,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error searching recipes: {str(e)}",
        )


@router.get("", response_model=RecipeListResponse)
async def list_recipes(
    category: Optional[str] = Query(None, description="Filter by category"),
    difficulty: Optional[str] = Query(None, description="Filter by difficulty"),
    max_prep_time: Optional[int] = Query(None, ge=0, description="Max prep time"),
    max_calories: Optional[int] = Query(None, ge=0, description="Max calories"),
    min_protein: Optional[float] = Query(None, ge=0, description="Min protein"),
    page: int = Query(default=1, ge=1, description="Page number"),
    page_size: int = Query(default=20, ge=1, le=100, description="Items per page"),
    db: Session = Depends(get_db),
) -> RecipeListResponse:
    """
    List recipes with optional filters and pagination

    **Query Parameters:**
    - `category`: Filter by category (cafe-da-manha, almoco, jantar, lanche)
    - `difficulty`: Filter by difficulty (facil, medio, dificil)
    - `max_prep_time`: Maximum preparation time in minutes
    - `max_calories`: Maximum calories per serving
    - `min_protein`: Minimum protein in grams
    - `page`: Page number (default: 1)
    - `page_size`: Items per page (default: 20, max: 100)

    **Response:**
    - `recipes`: Array of recipe objects
    - `total`: Total number of matching recipes
    - `page`: Current page
    - `page_size`: Items per page
    """
    try:
        offset = (page - 1) * page_size
        recipes, total = recipe_service.list_recipes(
            session=db,
            category=category,
            difficulty=difficulty,
            max_prep_time=max_prep_time,
            max_calories=max_calories,
            min_protein=min_protein,
            limit=page_size,
            offset=offset,
        )

        return RecipeListResponse(
            recipes=[RecipeSimpleResponse.model_validate(r) for r in recipes],
            total=total,
            page=page,
            page_size=page_size,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error listing recipes: {str(e)}",
        )


@router.get("/{recipe_id}", response_model=RecipeResponse)
async def get_recipe(
    recipe_id: UUID, db: Session = Depends(get_db)
) -> RecipeResponse:
    """
    Get a specific recipe by ID

    **Path Parameters:**
    - `recipe_id`: UUID of the recipe

    **Response:**
    - Full recipe object with all fields
    """
    recipe = recipe_service.get_recipe(db, recipe_id)

    if not recipe:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recipe not found",
        )

    return RecipeResponse.model_validate(recipe)


@router.post("", response_model=RecipeResponse, status_code=status.HTTP_201_CREATED)
async def create_recipe(
    request: RecipeCreate, db: Session = Depends(get_db)
) -> RecipeResponse:
    """
    Create a new recipe

    **Request Body:**
    - `name`: Recipe name (required)
    - `description`: Recipe description (required)
    - `category`: Category (cafe-da-manha, almoco, jantar, lanche) (required)
    - `prep_time_minutes`: Preparation time in minutes (required)
    - `difficulty`: Difficulty level (facil, medio, dificil) (required)
    - `calories`: Total calories per serving (required)
    - `protein_g`: Protein in grams (required)
    - `carbs_g`: Carbohydrates in grams (required)
    - `fat_g`: Fat in grams (required)
    - `ingredients`: List of ingredients (required, min 1 item)
    - `instructions`: Cooking instructions (optional)

    **Response:**
    - Created recipe object with ID and timestamps

    **Note:** In a production environment, this endpoint should be protected
    with authentication and authorization (admin only).
    """
    try:
        recipe = recipe_service.create_recipe(db, request)
        return RecipeResponse.model_validate(recipe)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating recipe: {str(e)}",
        )


@router.put("/{recipe_id}", response_model=RecipeResponse)
async def update_recipe(
    recipe_id: UUID, request: RecipeUpdate, db: Session = Depends(get_db)
) -> RecipeResponse:
    """
    Update an existing recipe

    **Path Parameters:**
    - `recipe_id`: UUID of the recipe to update

    **Request Body:**
    - All fields are optional (only provided fields will be updated)

    **Response:**
    - Updated recipe object

    **Note:** In a production environment, this endpoint should be protected
    with authentication and authorization (admin only).
    """
    recipe = recipe_service.update_recipe(db, recipe_id, request)

    if not recipe:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recipe not found",
        )

    return RecipeResponse.model_validate(recipe)


@router.delete("/{recipe_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_recipe(recipe_id: UUID, db: Session = Depends(get_db)) -> None:
    """
    Delete a recipe

    **Path Parameters:**
    - `recipe_id`: UUID of the recipe to delete

    **Response:**
    - 204 No Content on success
    - 404 Not Found if recipe doesn't exist

    **Note:** In a production environment, this endpoint should be protected
    with authentication and authorization (admin only).
    """
    deleted = recipe_service.delete_recipe(db, recipe_id)

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recipe not found",
        )
