from uuid import UUID


class UserAlreadyExistsError(Exception):
    def __init__(self, username: str) -> None:
        super().__init__(f"Username '{username}' already taken")


class ProfileAlreadyExistsError(Exception):
    def __init__(self, user_id: UUID) -> None:
        super().__init__(f"Profile already exists for user {user_id}")


class ProfileNotFoundError(Exception):
    def __init__(self, user_id: UUID) -> None:
        super().__init__(f"Profile not found for user {user_id}")
