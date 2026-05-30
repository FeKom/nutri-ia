from uuid import UUID


class GoalNotFoundError(Exception):
    def __init__(self, goal_id: UUID) -> None:
        super().__init__(f"Goal {goal_id} not found")
        self.goal_id = goal_id
