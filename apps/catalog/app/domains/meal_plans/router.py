import io
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlmodel import Session

from app.api.dependencies import get_current_user_id, get_db
from app.domains.meal_plans.exceptions import MealPlanNotFoundError
from app.domains.meal_plans.repository import SQLModelMealPlanRepository
from app.schemas.meal_plan import (
    MealPlanCreate,
    MealPlanListResponse,
    MealPlanResponse,
    MealPlanUpdate,
)
from app.services.pdf_service import generate_meal_plan_pdf

router = APIRouter()


def _get_repo(session: Session = Depends(get_db)) -> SQLModelMealPlanRepository:
    return SQLModelMealPlanRepository(session)


_Repo = Annotated[SQLModelMealPlanRepository, Depends(_get_repo)]


@router.post("", response_model=MealPlanResponse, status_code=status.HTTP_201_CREATED)
async def create_meal_plan(
    data: MealPlanCreate,
    repo: _Repo,
    current_user_id: str = Depends(get_current_user_id),
) -> MealPlanResponse:
    return MealPlanResponse.model_validate(repo.create(UUID(current_user_id), data))


@router.get("", response_model=MealPlanListResponse)
async def list_meal_plans(
    repo: _Repo,
    current_user_id: str = Depends(get_current_user_id),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
) -> MealPlanListResponse:
    offset = (page - 1) * page_size
    plans, total = repo.list_by_user(
        UUID(current_user_id), limit=page_size, offset=offset
    )
    return MealPlanListResponse(
        plans=[MealPlanResponse.model_validate(p) for p in plans],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{plan_id}", response_model=MealPlanResponse)
async def get_meal_plan(
    plan_id: UUID, repo: _Repo, current_user_id: str = Depends(get_current_user_id)
) -> MealPlanResponse:
    plan = repo.get_by_id(plan_id, UUID(current_user_id))
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(MealPlanNotFoundError(plan_id)),
        )
    return MealPlanResponse.model_validate(plan)


@router.put("/{plan_id}", response_model=MealPlanResponse)
async def update_meal_plan(
    plan_id: UUID,
    data: MealPlanUpdate,
    repo: _Repo,
    current_user_id: str = Depends(get_current_user_id),
) -> MealPlanResponse:
    plan = repo.update(plan_id, UUID(current_user_id), data)
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(MealPlanNotFoundError(plan_id)),
        )
    return MealPlanResponse.model_validate(plan)


@router.delete("/{plan_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_meal_plan(
    plan_id: UUID, repo: _Repo, current_user_id: str = Depends(get_current_user_id)
) -> None:
    if not repo.delete(plan_id, UUID(current_user_id)):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(MealPlanNotFoundError(plan_id)),
        )


@router.get("/{plan_id}/pdf")
async def export_pdf(
    plan_id: UUID, repo: _Repo, current_user_id: str = Depends(get_current_user_id)
):
    plan = repo.get_by_id(plan_id, UUID(current_user_id))
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(MealPlanNotFoundError(plan_id)),
        )
    pdf_bytes = generate_meal_plan_pdf(plan)
    filename = f"plano-alimentar-{plan.plan_name.replace(' ', '-').lower()}.pdf"
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
