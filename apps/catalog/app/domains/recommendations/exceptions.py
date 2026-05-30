from uuid import UUID


class UserProfileNotFoundError(Exception):
    def __init__(self, user_id: UUID) -> None:
        super().__init__(f"User profile {user_id} not found")
        self.user_id = user_id
