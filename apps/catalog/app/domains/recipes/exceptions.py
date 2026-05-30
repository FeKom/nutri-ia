from uuid import UUID


class RecipeNotFoundError(Exception):
    def __init__(self, recipe_id: UUID) -> None:
        super().__init__(f"Recipe {recipe_id} not found")
        self.recipe_id = recipe_id
