from typing import Dict, List, Optional, Tuple
from uuid import UUID

from sqlmodel import Session

from app.domains.food_catalog.exceptions import FoodNotFoundError
from app.domains.food_catalog.repository import SQLModelFoodRepository
from app.domains.food_catalog.schemas import FoodSearchFilters
from app.domains.food_catalog.service import FoodService
from app.models.food import Food


def _svc(session: Session) -> FoodService:
    return FoodService(SQLModelFoodRepository(session))


def search_foods(
    session: Session,
    query,
    limit: int = 10,
    filters: Optional[FoodSearchFilters] = None,
) -> List[Food]:
    q = [query] if isinstance(query, str) else query
    return _svc(session).search(q, limit, filters)


def get_food_by_id(session: Session, food_id: UUID) -> Optional[Food]:
    try:
        return _svc(session).get_food(food_id)
    except FoodNotFoundError:
        return None


def get_foods_by_ids(session: Session, food_ids: List[UUID]) -> List[Food]:
    return SQLModelFoodRepository(session).get_by_ids(food_ids)


def get_food_with_nutrients(session: Session, food_id: UUID) -> Optional[Food]:
    try:
        return _svc(session).get_food_with_nutrients(food_id)
    except FoodNotFoundError:
        return None


def search_foods_by_embedding(
    session: Session, query, limit: int = 10, filters=None, min_similarity: float = 0.0
) -> List[Tuple[Food, float]]:
    q = [query] if isinstance(query, str) else query
    return _svc(session).search_by_embedding(q, limit, filters, min_similarity)


def find_similar_foods(
    session: Session, food_id: UUID, limit: int = 10, same_category: bool = False
) -> List[Tuple[Food, float]]:
    try:
        return _svc(session).find_similar(food_id, limit, same_category)
    except FoodNotFoundError:
        return []


def resolve_foods(
    session: Session,
    queries: List[str],
    min_similarity: float = 0.4,
    limit_per_query: int = 1,
) -> Dict[str, List[Tuple[Food, float]]]:
    return _svc(session).resolve_batch(queries, min_similarity, limit_per_query)
