from datetime import datetime
from typing import Optional, Protocol
from uuid import UUID

from sqlmodel import Session, select

from app.models.auth import User
from app.models.user import UserProfile


class IdentityRepository(Protocol):
    def get_user_by_username(self, username: str) -> Optional[User]: ...
    def create_user(self, username: str, name: str, hashed_password: str) -> User: ...
    def get_profile(self, user_id: UUID) -> Optional[UserProfile]: ...
    def create_profile(self, user_id: UUID, **fields) -> UserProfile: ...
    def update_profile(self, user_id: UUID, fields: dict) -> Optional[UserProfile]: ...
    def delete_profile(self, user_id: UUID) -> bool: ...


class SQLModelIdentityRepository:
    def __init__(self, session: Session) -> None:
        self._s = session

    def get_user_by_username(self, username: str) -> Optional[User]:
        return self._s.exec(select(User).where(User.username == username)).first()

    def create_user(self, username: str, name: str, hashed_password: str) -> User:
        user = User(username=username, name=name, hashed_password=hashed_password)
        self._s.add(user)
        self._s.commit()
        self._s.refresh(user)
        return user

    def get_profile(self, user_id: UUID) -> Optional[UserProfile]:
        return self._s.exec(
            select(UserProfile).where(UserProfile.user_id == user_id)
        ).first()

    def get_profile_by_id(self, user_id: UUID) -> Optional[UserProfile]:
        return self.get_profile(user_id)

    def create_profile(self, user_id: UUID, **fields) -> UserProfile:
        profile = UserProfile(user_id=user_id, **fields)
        self._s.add(profile)
        self._s.commit()
        self._s.refresh(profile)
        return profile

    def update_profile(self, user_id: UUID, fields: dict) -> Optional[UserProfile]:
        profile = self.get_profile(user_id)
        if not profile:
            return None
        for k, v in fields.items():
            setattr(profile, k, v)
        profile.updated_at = datetime.utcnow()
        self._s.add(profile)
        self._s.commit()
        self._s.refresh(profile)
        return profile

    def delete_profile(self, user_id: UUID) -> bool:
        profile = self.get_profile(user_id)
        if not profile:
            return False
        self._s.delete(profile)
        self._s.commit()
        return True
