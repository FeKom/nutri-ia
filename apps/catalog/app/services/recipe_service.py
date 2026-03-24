from typing import List, Optional, Tuple
from sqlmodel import Session, select, or_, col, func
from uuid import UUID
import logging
import sqlalchemy as sa

from app.models.recipe import Recipe
from app.schemas.recipe import RecipeCreate, RecipeUpdate

logger = logging.getLogger(__name__)


def get_recipe(session: Session, recipe_id: UUID) -> Optional[Recipe]:
    """
    Get a single recipe by ID

    Args:
        session: Database session
        recipe_id: UUID of the recipe

    Returns:
        Recipe object if found, None otherwise
    """
    statement = select(Recipe).where(Recipe.id == recipe_id)
    return session.exec(statement).first()


def list_recipes(
    session: Session,
    category: Optional[str] = None,
    difficulty: Optional[str] = None,
    max_prep_time: Optional[int] = None,
    max_calories: Optional[int] = None,
    min_protein: Optional[float] = None,
    limit: int = 20,
    offset: int = 0,
) -> Tuple[List[Recipe], int]:
    """
    List recipes with optional filters and pagination

    Args:
        session: Database session
        category: Filter by category (cafe-da-manha, almoco, jantar, lanche)
        difficulty: Filter by difficulty (facil, medio, dificil)
        max_prep_time: Maximum preparation time in minutes
        max_calories: Maximum calories per serving
        min_protein: Minimum protein in grams
        limit: Maximum number of results
        offset: Offset for pagination

    Returns:
        Tuple of (list of recipes, total count)
    """
    # Build query
    statement = select(Recipe)

    # Apply filters
    if category:
        statement = statement.where(Recipe.category == category)
    if difficulty:
        statement = statement.where(Recipe.difficulty == difficulty)
    if max_prep_time is not None:
        statement = statement.where(Recipe.prep_time_minutes <= max_prep_time)
    if max_calories is not None:
        statement = statement.where(Recipe.calories <= max_calories)
    if min_protein is not None:
        statement = statement.where(Recipe.protein_g >= min_protein)

    # Get total count
    count_statement = select(func.count()).select_from(statement.subquery())
    total = session.exec(count_statement).one()

    # Apply pagination and order
    statement = (
        statement.order_by(Recipe.created_at.desc()).offset(offset).limit(limit)
    )

    # Execute
    recipes = list(session.exec(statement).all())

    return recipes, total


def search_recipes(
    session: Session,
    query: str,
    category: Optional[str] = None,
    difficulty: Optional[str] = None,
    max_prep_time: Optional[int] = None,
    max_calories: Optional[int] = None,
    min_protein: Optional[float] = None,
    limit: int = 20,
    offset: int = 0,
) -> Tuple[List[Recipe], int]:
    """
    Search recipes by text query (name, description, ingredients)

    Args:
        session: Database session
        query: Search query string
        category: Filter by category
        difficulty: Filter by difficulty
        max_prep_time: Maximum prep time
        max_calories: Maximum calories
        min_protein: Minimum protein
        limit: Maximum number of results
        offset: Offset for pagination

    Returns:
        Tuple of (list of recipes, total count)
    """
    # Build search query
    search_term = f"%{query.lower()}%"
    statement = select(Recipe).where(
        or_(
            col(Recipe.name).ilike(search_term),
            col(Recipe.description).ilike(search_term),
            # Search in ingredients JSON array (cast to text)
            func.cast(Recipe.ingredients, sa.Text).ilike(search_term),
        )
    )

    # Apply additional filters
    if category:
        statement = statement.where(Recipe.category == category)
    if difficulty:
        statement = statement.where(Recipe.difficulty == difficulty)
    if max_prep_time is not None:
        statement = statement.where(Recipe.prep_time_minutes <= max_prep_time)
    if max_calories is not None:
        statement = statement.where(Recipe.calories <= max_calories)
    if min_protein is not None:
        statement = statement.where(Recipe.protein_g >= min_protein)

    # Get total count
    count_statement = select(func.count()).select_from(statement.subquery())
    total = session.exec(count_statement).one()

    # Apply pagination and order
    statement = (
        statement.order_by(Recipe.created_at.desc()).offset(offset).limit(limit)
    )

    # Execute
    recipes = list(session.exec(statement).all())

    return recipes, total


def create_recipe(session: Session, recipe_data: RecipeCreate) -> Recipe:
    """
    Create a new recipe

    Args:
        session: Database session
        recipe_data: Recipe creation data

    Returns:
        Created Recipe object
    """
    recipe = Recipe(**recipe_data.model_dump())
    session.add(recipe)
    session.commit()
    session.refresh(recipe)
    logger.info(f"Created recipe: {recipe.name} (id={recipe.id})")
    return recipe


def update_recipe(
    session: Session, recipe_id: UUID, recipe_data: RecipeUpdate
) -> Optional[Recipe]:
    """
    Update an existing recipe

    Args:
        session: Database session
        recipe_id: UUID of the recipe to update
        recipe_data: Update data (only non-None fields are updated)

    Returns:
        Updated Recipe object if found, None otherwise
    """
    recipe = get_recipe(session, recipe_id)
    if not recipe:
        return None

    # Update only provided fields
    update_data = recipe_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(recipe, field, value)

    session.add(recipe)
    session.commit()
    session.refresh(recipe)
    logger.info(f"Updated recipe: {recipe.name} (id={recipe.id})")
    return recipe


def delete_recipe(session: Session, recipe_id: UUID) -> bool:
    """
    Delete a recipe

    Args:
        session: Database session
        recipe_id: UUID of the recipe to delete

    Returns:
        True if deleted, False if not found
    """
    recipe = get_recipe(session, recipe_id)
    if not recipe:
        return False

    session.delete(recipe)
    session.commit()
    logger.info(f"Deleted recipe: {recipe.name} (id={recipe_id})")
    return True
