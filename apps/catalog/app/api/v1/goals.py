from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

from app.api.dependencies import get_current_user_id, get_db
from app.schemas.goals import GoalCreate, GoalResponse, GoalUpdate
from app.services import goals_service

router = APIRouter()


@router.get("", response_model=list[GoalResponse])
def list_goals(
    db: Session = Depends(get_db),
    current_user_id: str = Depends(get_current_user_id),
) -> list[GoalResponse]:
    """List all goals for the authenticated user."""
    goals = goals_service.list_goals(db, UUID(current_user_id))
    return [GoalResponse(
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
    ) for g in goals]


@router.post("", response_model=GoalResponse, status_code=status.HTTP_201_CREATED)
def create_goal(
    data: GoalCreate,
    db: Session = Depends(get_db),
    current_user_id: str = Depends(get_current_user_id),
) -> GoalResponse:
    """Create a new goal for the authenticated user."""
    goal = goals_service.create_goal(db, UUID(current_user_id), data)
    return GoalResponse(
        id=goal.id,
        user_id=goal.user_id,
        title=goal.title,
        description=goal.description,
        target_value=goal.target_value,
        current_value=goal.current_value,
        unit=goal.unit,
        category=goal.category,
        deadline=goal.deadline,
        created_at=goal.created_at.isoformat(),
    )


@router.patch("/{goal_id}", response_model=GoalResponse)
def update_goal(
    goal_id: UUID,
    data: GoalUpdate,
    db: Session = Depends(get_db),
    current_user_id: str = Depends(get_current_user_id),
) -> GoalResponse:
    """Update a goal (e.g. current_value progress)."""
    goal = goals_service.update_goal(db, goal_id, UUID(current_user_id), data)
    if not goal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found")
    return GoalResponse(
        id=goal.id,
        user_id=goal.user_id,
        title=goal.title,
        description=goal.description,
        target_value=goal.target_value,
        current_value=goal.current_value,
        unit=goal.unit,
        category=goal.category,
        deadline=goal.deadline,
        created_at=goal.created_at.isoformat(),
    )


@router.delete("/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_goal(
    goal_id: UUID,
    db: Session = Depends(get_db),
    current_user_id: str = Depends(get_current_user_id),
) -> None:
    """Delete a goal."""
    if not goals_service.delete_goal(db, goal_id, UUID(current_user_id)):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found")
