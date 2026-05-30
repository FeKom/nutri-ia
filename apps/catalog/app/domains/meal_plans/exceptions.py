from uuid import UUID


class MealPlanNotFoundError(Exception):
    def __init__(self, plan_id: UUID) -> None:
        super().__init__(f"Meal plan {plan_id} not found")
        self.plan_id = plan_id
