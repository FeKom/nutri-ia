from typing import List, Optional
from uuid import UUID

from sqlmodel import Session, select

from app.models.activity_log import ActivityLog
from app.schemas.activity_log import ActivityLogCreate


def create_activity(session: Session, user_id: UUID, data: ActivityLogCreate) -> ActivityLog:
    activity = ActivityLog(
        user_id=user_id,
        type=data.type,
        duration_minutes=data.duration_minutes,
        calories_burned=data.calories_burned,
        date=data.date,
        notes=data.notes,
    )
    session.add(activity)
    session.commit()
    session.refresh(activity)
    return activity


def list_activities(session: Session, user_id: UUID, limit: int = 50) -> List[ActivityLog]:
    return list(
        session.exec(
            select(ActivityLog)
            .where(ActivityLog.user_id == user_id)
            .order_by(ActivityLog.date.desc(), ActivityLog.created_at.desc())
            .limit(limit)
        ).all()
    )


def delete_activity(session: Session, activity_id: UUID, user_id: UUID) -> bool:
    activity = session.exec(
        select(ActivityLog).where(ActivityLog.id == activity_id, ActivityLog.user_id == user_id)
    ).first()
    if not activity:
        return False
    session.delete(activity)
    session.commit()
    return True
