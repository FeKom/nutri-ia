from datetime import date
from typing import List, Optional, Protocol
from uuid import UUID

from sqlmodel import Session, select

from app.models.goals import Goal


class GoalRepository(Protocol):
    def list_by_user(self, user_id: UUID) -> List[Goal]: ...
    def create(
        self,
        user_id: UUID,
        title: str,
        description: Optional[str],
        target_value: float,
        current_value: float,
        unit: str,
        category: str,
        deadline: Optional[date],
    ) -> Goal: ...
    def update(self, goal_id: UUID, user_id: UUID, fields: dict) -> Optional[Goal]: ...
    def delete(self, goal_id: UUID, user_id: UUID) -> bool: ...


class SQLModelGoalRepository:
    def __init__(self, session: Session) -> None:
        self._s = session

    def list_by_user(self, user_id: UUID) -> List[Goal]:
        return list(
            self._s.exec(
                select(Goal)
                .where(Goal.user_id == user_id)
                .order_by(Goal.created_at.desc())
            ).all()
        )

    def create(
        self,
        user_id: UUID,
        title: str,
        description: Optional[str],
        target_value: float,
        current_value: float,
        unit: str,
        category: str,
        deadline: Optional[date],
    ) -> Goal:
        goal = Goal(
            user_id=user_id,
            title=title,
            description=description,
            target_value=target_value,
            current_value=current_value,
            unit=unit,
            category=category,
            deadline=deadline,
        )
        self._s.add(goal)
        self._s.commit()
        self._s.refresh(goal)
        return goal

    def update(self, goal_id: UUID, user_id: UUID, fields: dict) -> Optional[Goal]:
        goal = self._s.exec(
            select(Goal).where(Goal.id == goal_id, Goal.user_id == user_id)
        ).first()
        if not goal:
            return None
        for k, v in fields.items():
            setattr(goal, k, v)
        self._s.add(goal)
        self._s.commit()
        self._s.refresh(goal)
        return goal

    def delete(self, goal_id: UUID, user_id: UUID) -> bool:
        goal = self._s.exec(
            select(Goal).where(Goal.id == goal_id, Goal.user_id == user_id)
        ).first()
        if not goal:
            return False
        self._s.delete(goal)
        self._s.commit()
        return True
