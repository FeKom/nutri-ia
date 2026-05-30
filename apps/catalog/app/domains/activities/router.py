from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

from app.api.dependencies import get_current_user_id, get_db
from app.domains.activities.exceptions import ActivityNotFoundError
from app.domains.activities.repository import SQLModelActivityRepository
from app.domains.activities.schemas import ActivityLogCreate, ActivityLogResponse

router = APIRouter()


def _get_repo(session: Session = Depends(get_db)) -> SQLModelActivityRepository:
    return SQLModelActivityRepository(session)


_Repo = Annotated[SQLModelActivityRepository, Depends(_get_repo)]


def _resp(a) -> ActivityLogResponse:
    return ActivityLogResponse(
        id=a.id,
        user_id=a.user_id,
        type=a.type,
        duration_minutes=a.duration_minutes,
        calories_burned=a.calories_burned,
        date=a.date,
        notes=a.notes,
        created_at=a.created_at.isoformat(),
    )


@router.get("", response_model=list[ActivityLogResponse])
def list_activities(repo: _Repo, current_user_id: str = Depends(get_current_user_id)):
    return [_resp(a) for a in repo.list_by_user(UUID(current_user_id))]


@router.post(
    "", response_model=ActivityLogResponse, status_code=status.HTTP_201_CREATED
)
def create_activity(
    data: ActivityLogCreate,
    repo: _Repo,
    current_user_id: str = Depends(get_current_user_id),
):
    a = repo.create(
        UUID(current_user_id),
        data.type,
        data.duration_minutes,
        data.calories_burned,
        data.date,
        data.notes,
    )
    return _resp(a)


@router.delete("/{activity_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_activity(
    activity_id: UUID, repo: _Repo, current_user_id: str = Depends(get_current_user_id)
):
    if not repo.delete(activity_id, UUID(current_user_id)):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(ActivityNotFoundError(activity_id)),
        )
