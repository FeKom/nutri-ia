from typing import Dict, List, Optional, Tuple
from uuid import UUID

from app.domains.food_catalog.exceptions import FoodNotFoundError
from app.domains.food_catalog.repository import SQLModelFoodRepository
from app.domains.food_catalog.schemas import FoodSearchFilters
from app.models.food import Food


class FoodService:
    def __init__(self, repo: SQLModelFoodRepository) -> None:
        self._repo = repo

    def get_food(self, food_id: UUID) -> Food:
        food = self._repo.get_by_id(food_id)
        if not food:
            raise FoodNotFoundError(food_id)
        return food

    def get_food_with_nutrients(self, food_id: UUID) -> Food:
        food = self._repo.get_with_nutrients(food_id)
        if not food:
            raise FoodNotFoundError(food_id)
        return food

    def search(
        self,
        query: List[str],
        limit: int = 10,
        filters: Optional[FoodSearchFilters] = None,
    ) -> List[Food]:
        return self._repo.search(query, limit, filters)

    def search_by_embedding(
        self,
        query: List[str],
        limit: int = 10,
        filters: Optional[FoodSearchFilters] = None,
        min_similarity: float = 0.0,
    ) -> List[Tuple[Food, float]]:
        return self._repo.search_by_embedding(query, limit, filters, min_similarity)

    def find_similar(
        self, food_id: UUID, limit: int = 10, same_category: bool = False
    ) -> List[Tuple[Food, float]]:
        self.get_food(food_id)
        return self._repo.find_similar(food_id, limit, same_category)

    def resolve_batch(
        self, queries: List[str], min_similarity: float = 0.4, limit_per_query: int = 1
    ) -> Dict[str, List[Tuple[Food, float]]]:
        return self._repo.resolve_batch(queries, min_similarity, limit_per_query)
