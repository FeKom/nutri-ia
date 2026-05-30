from uuid import UUID


class ActivityNotFoundError(Exception):
    def __init__(self, activity_id: UUID) -> None:
        super().__init__(f"Activity {activity_id} not found")
        self.activity_id = activity_id
