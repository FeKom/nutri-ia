from typing import List, Optional
from uuid import UUID

from sqlmodel import Session, select

from app.models.goals import Goal
from app.schemas.goals import GoalCreate, GoalUpdate


def create_goal(session: Session, user_id: UUID, data: GoalCreate) -> Goal:
    goal = Goal(
        user_id=user_id,
        title=data.title,
        description=data.description,
        target_value=data.target_value,
        current_value=data.current_value,
        unit=data.unit,
        category=data.category,
        deadline=data.deadline,
    )
    session.add(goal)
    session.commit()
    session.refresh(goal)
    return goal


def list_goals(session: Session, user_id: UUID) -> List[Goal]:
    return list(session.exec(select(Goal).where(Goal.user_id == user_id).order_by(Goal.created_at.desc())).all())


def update_goal(session: Session, goal_id: UUID, user_id: UUID, data: GoalUpdate) -> Optional[Goal]:
    goal = session.exec(select(Goal).where(Goal.id == goal_id, Goal.user_id == user_id)).first()
    if not goal:
        return None
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(goal, field, value)
    session.add(goal)
    session.commit()
    session.refresh(goal)
    return goal


def delete_goal(session: Session, goal_id: UUID, user_id: UUID) -> bool:
    goal = session.exec(select(Goal).where(Goal.id == goal_id, Goal.user_id == user_id)).first()
    if not goal:
        return False
    session.delete(goal)
    session.commit()
    return True
