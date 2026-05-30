from datetime import date
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

from app.api.dependencies import get_current_user_id, get_db
from app.domains.tracking.exceptions import InvalidFoodError, MealNotFoundError
from app.domains.tracking.repository import SQLModelTrackingRepository
from app.schemas.tracking import (
    DailySummaryResponse,
    MealLogRequest,
    MealLogResponse,
    MealLogUpdate,
    WeeklyStatsResponse,
)

router = APIRouter()


def _get_repo(session: Session = Depends(get_db)) -> SQLModelTrackingRepository:
    return SQLModelTrackingRepository(session)


_Repo = Annotated[SQLModelTrackingRepository, Depends(_get_repo)]


@router.post(
    "/meals/log", response_model=MealLogResponse, status_code=status.HTTP_201_CREATED
)
async def log_meal(
    request: MealLogRequest,
    repo: _Repo,
    current_user_id: str = Depends(get_current_user_id),
) -> MealLogResponse:
    request.user_id = UUID(current_user_id)
    try:
        return repo.log_meal(request)
    except InvalidFoodError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.put("/meals/{meal_id}", response_model=MealLogResponse)
async def update_meal(
    meal_id: UUID,
    updates: MealLogUpdate,
    repo: _Repo,
    current_user_id: str = Depends(get_current_user_id),
) -> MealLogResponse:
    try:
        return repo.update_meal(meal_id, UUID(current_user_id), updates)
    except MealNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except (InvalidFoodError, ValueError) as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/meals/{meal_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_meal(
    meal_id: UUID, repo: _Repo, current_user_id: str = Depends(get_current_user_id)
) -> None:
    try:
        repo.delete_meal(meal_id, UUID(current_user_id))
    except MealNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("/summary/daily", response_model=DailySummaryResponse)
async def get_daily_summary(
    repo: _Repo,
    current_user_id: str = Depends(get_current_user_id),
    target_date: date = date.today(),
) -> DailySummaryResponse:
    return repo.get_daily_summary(UUID(current_user_id), target_date)


@router.get("/stats/weekly", response_model=WeeklyStatsResponse)
async def get_weekly_stats(
    repo: _Repo, current_user_id: str = Depends(get_current_user_id), days: int = 7
) -> WeeklyStatsResponse:
    return repo.get_weekly_stats(UUID(current_user_id), days)
