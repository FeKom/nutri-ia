from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

from app.api.dependencies import get_current_user_id, get_db
from app.domains.goals.exceptions import GoalNotFoundError
from app.domains.goals.repository import SQLModelGoalRepository
from app.domains.goals.schemas import GoalCreate, GoalResponse, GoalUpdate

router = APIRouter()


def _get_repo(session: Session = Depends(get_db)) -> SQLModelGoalRepository:
    return SQLModelGoalRepository(session)


_Repo = Annotated[SQLModelGoalRepository, Depends(_get_repo)]


def _resp(g) -> GoalResponse:
    return GoalResponse(
        id=g.id,
        user_id=g.user_id,
        title=g.title,
        description=g.description,
        target_value=g.target_value,
        current_value=g.current_value,
        unit=g.unit,
        category=g.category,
        deadline=g.deadline,
        created_at=g.created_at.isoformat(),
    )


@router.get("", response_model=list[GoalResponse])
def list_goals(repo: _Repo, current_user_id: str = Depends(get_current_user_id)):
    return [_resp(g) for g in repo.list_by_user(UUID(current_user_id))]


@router.post("", response_model=GoalResponse, status_code=status.HTTP_201_CREATED)
def create_goal(
    data: GoalCreate, repo: _Repo, current_user_id: str = Depends(get_current_user_id)
):
    g = repo.create(
        UUID(current_user_id),
        data.title,
        data.description,
        data.target_value,
        data.current_value,
        data.unit,
        data.category,
        data.deadline,
    )
    return _resp(g)


@router.patch("/{goal_id}", response_model=GoalResponse)
def update_goal(
    goal_id: UUID,
    data: GoalUpdate,
    repo: _Repo,
    current_user_id: str = Depends(get_current_user_id),
):
    g = repo.update(goal_id, UUID(current_user_id), data.model_dump(exclude_none=True))
    if not g:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(GoalNotFoundError(goal_id)),
        )
    return _resp(g)


@router.delete("/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_goal(
    goal_id: UUID, repo: _Repo, current_user_id: str = Depends(get_current_user_id)
):
    if not repo.delete(goal_id, UUID(current_user_id)):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(GoalNotFoundError(goal_id)),
        )
