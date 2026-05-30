from datetime import date
from typing import List, Optional, Protocol
from uuid import UUID

from sqlmodel import Session, select

from app.models.activity_log import ActivityLog


class ActivityRepository(Protocol):
    def list_by_user(self, user_id: UUID, limit: int) -> List[ActivityLog]: ...
    def create(
        self,
        user_id: UUID,
        type: str,
        duration_minutes: int,
        calories_burned: int,
        date: date,
        notes: Optional[str],
    ) -> ActivityLog: ...
    def delete(self, activity_id: UUID, user_id: UUID) -> bool: ...


class SQLModelActivityRepository:
    def __init__(self, session: Session) -> None:
        self._s = session

    def list_by_user(self, user_id: UUID, limit: int = 50) -> List[ActivityLog]:
        return list(
            self._s.exec(
                select(ActivityLog)
                .where(ActivityLog.user_id == user_id)
                .order_by(ActivityLog.date.desc(), ActivityLog.created_at.desc())
                .limit(limit)
            ).all()
        )

    def create(
        self,
        user_id: UUID,
        type: str,
        duration_minutes: int,
        calories_burned: int,
        date: date,
        notes: Optional[str],
    ) -> ActivityLog:
        a = ActivityLog(
            user_id=user_id,
            type=type,
            duration_minutes=duration_minutes,
            calories_burned=calories_burned,
            date=date,
            notes=notes,
        )
        self._s.add(a)
        self._s.commit()
        self._s.refresh(a)
        return a

    def delete(self, activity_id: UUID, user_id: UUID) -> bool:
        a = self._s.exec(
            select(ActivityLog).where(
                ActivityLog.id == activity_id, ActivityLog.user_id == user_id
            )
        ).first()
        if not a:
            return False
        self._s.delete(a)
        self._s.commit()
        return True
