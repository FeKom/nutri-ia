from datetime import datetime
from typing import List, Optional, Protocol, Tuple
from uuid import UUID

from sqlmodel import Session, func, select

from app.models.user import MealPlan
from app.schemas.meal_plan import MealPlanCreate, MealPlanUpdate


class MealPlanRepository(Protocol):
    def create(self, user_id: UUID, data: MealPlanCreate) -> MealPlan: ...
    def list_by_user(
        self, user_id: UUID, limit: int, offset: int
    ) -> Tuple[List[MealPlan], int]: ...
    def get_by_id(self, plan_id: UUID, user_id: UUID) -> Optional[MealPlan]: ...
    def update(
        self, plan_id: UUID, user_id: UUID, data: MealPlanUpdate
    ) -> Optional[MealPlan]: ...
    def delete(self, plan_id: UUID, user_id: UUID) -> bool: ...


class SQLModelMealPlanRepository:
    def __init__(self, session: Session) -> None:
        self._s = session

    def create(self, user_id: UUID, data: MealPlanCreate) -> MealPlan:
        plan = MealPlan(user_id=user_id, **data.model_dump())
        self._s.add(plan)
        self._s.commit()
        self._s.refresh(plan)
        return plan

    def list_by_user(
        self, user_id: UUID, limit: int = 10, offset: int = 0
    ) -> Tuple[List[MealPlan], int]:
        total = self._s.exec(
            select(func.count())
            .select_from(MealPlan)
            .where(MealPlan.user_id == user_id)
        ).one()
        plans = list(
            self._s.exec(
                select(MealPlan)
                .where(MealPlan.user_id == user_id)
                .order_by(MealPlan.created_at.desc())
                .offset(offset)
                .limit(limit)
            ).all()
        )
        return plans, total

    def get_by_id(self, plan_id: UUID, user_id: UUID) -> Optional[MealPlan]:
        return self._s.exec(
            select(MealPlan).where(MealPlan.id == plan_id, MealPlan.user_id == user_id)
        ).first()

    def update(
        self, plan_id: UUID, user_id: UUID, data: MealPlanUpdate
    ) -> Optional[MealPlan]:
        plan = self.get_by_id(plan_id, user_id)
        if not plan:
            return None
        for k, v in data.model_dump(exclude_unset=True).items():
            setattr(plan, k, v)
        plan.updated_at = datetime.utcnow()
        self._s.add(plan)
        self._s.commit()
        self._s.refresh(plan)
        return plan

    def delete(self, plan_id: UUID, user_id: UUID) -> bool:
        plan = self.get_by_id(plan_id, user_id)
        if not plan:
            return False
        self._s.delete(plan)
        self._s.commit()
        return True
