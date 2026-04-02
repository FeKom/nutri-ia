from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

from app.api.dependencies import get_current_user_id, get_db
from app.schemas.activity_log import ActivityLogCreate, ActivityLogResponse
from app.services import activity_service

router = APIRouter()


@router.get("", response_model=list[ActivityLogResponse])
def list_activities(
    db: Session = Depends(get_db),
    current_user_id: str = Depends(get_current_user_id),
) -> list[ActivityLogResponse]:
    """List recent activities for the authenticated user."""
    activities = activity_service.list_activities(db, UUID(current_user_id))
    return [ActivityLogResponse(
        id=a.id,
        user_id=a.user_id,
        type=a.type,
        duration_minutes=a.duration_minutes,
        calories_burned=a.calories_burned,
        date=a.date,
        notes=a.notes,
        created_at=a.created_at.isoformat(),
    ) for a in activities]


@router.post("", response_model=ActivityLogResponse, status_code=status.HTTP_201_CREATED)
def create_activity(
    data: ActivityLogCreate,
    db: Session = Depends(get_db),
    current_user_id: str = Depends(get_current_user_id),
) -> ActivityLogResponse:
    """Log a new physical activity."""
    activity = activity_service.create_activity(db, UUID(current_user_id), data)
    return ActivityLogResponse(
        id=activity.id,
        user_id=activity.user_id,
        type=activity.type,
        duration_minutes=activity.duration_minutes,
        calories_burned=activity.calories_burned,
        date=activity.date,
        notes=activity.notes,
        created_at=activity.created_at.isoformat(),
    )


@router.delete("/{activity_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_activity(
    activity_id: UUID,
    db: Session = Depends(get_db),
    current_user_id: str = Depends(get_current_user_id),
) -> None:
    """Delete an activity log entry."""
    if not activity_service.delete_activity(db, activity_id, UUID(current_user_id)):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Activity not found")
