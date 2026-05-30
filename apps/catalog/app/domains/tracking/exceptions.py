from uuid import UUID


class MealNotFoundError(Exception):
    def __init__(self, meal_id: UUID) -> None:
        super().__init__(f"Meal {meal_id} not found")
        self.meal_id = meal_id


class InvalidFoodError(ValueError):
    def __init__(self, food_ids) -> None:
        super().__init__(f"Foods not found: {[str(i) for i in food_ids]}")
        self.food_ids = food_ids
