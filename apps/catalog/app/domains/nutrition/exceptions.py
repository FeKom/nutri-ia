from typing import List
from uuid import UUID


class FoodsNotFoundError(Exception):
    def __init__(self, food_ids: List[UUID]) -> None:
        super().__init__(f"Foods not found: {[str(i) for i in food_ids]}")
        self.food_ids = food_ids
