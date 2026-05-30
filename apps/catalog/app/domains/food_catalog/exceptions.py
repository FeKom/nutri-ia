from uuid import UUID


class FoodNotFoundError(Exception):
    def __init__(self, food_id: UUID) -> None:
        super().__init__(f"Food {food_id} not found")
        self.food_id = food_id


class EmptyQueryError(ValueError):
    def __init__(self) -> None:
        super().__init__("Query cannot be empty after normalization")
