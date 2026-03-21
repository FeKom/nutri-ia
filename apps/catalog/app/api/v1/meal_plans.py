import io
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlmodel import Session

from app.api.dependencies import get_current_user_id, get_db
from app.schemas.meal_plan import (
    MealPlanCreate,
    MealPlanListResponse,
    MealPlanResponse,
    MealPlanUpdate,
)
from app.services import meal_plan_service
from app.services.pdf_service import generate_meal_plan_pdf

router = APIRouter()


@router.post("", response_model=MealPlanResponse, status_code=status.HTTP_201_CREATED)
async def create_meal_plan(
    request: MealPlanCreate,
    db: Session = Depends(get_db),
    current_user_id: str = Depends(get_current_user_id),
) -> MealPlanResponse:
    """
    Create a new meal plan for the authenticated user.
    """
    try:
        meal_plan = meal_plan_service.create_meal_plan(
            db, UUID(current_user_id), request
        )
        return MealPlanResponse.model_validate(meal_plan)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating meal plan: {str(e)}",
        )


@router.get("", response_model=MealPlanListResponse)
async def list_meal_plans(
    page: int = Query(default=1, ge=1, description="Page number"),
    page_size: int = Query(default=10, ge=1, le=100, description="Items per page"),
    db: Session = Depends(get_db),
    current_user_id: str = Depends(get_current_user_id),
) -> MealPlanListResponse:
    """
    List all meal plans for the authenticated user with pagination.
    """
    try:
        return meal_plan_service.list_meal_plans(
            db, UUID(current_user_id), page, page_size
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error listing meal plans: {str(e)}",
        )


@router.get("/{plan_id}", response_model=MealPlanResponse)
async def get_meal_plan(
    plan_id: UUID,
    db: Session = Depends(get_db),
    current_user_id: str = Depends(get_current_user_id),
) -> MealPlanResponse:
    """
    Get a specific meal plan by ID. Validates ownership via JWT.
    """
    meal_plan = meal_plan_service.get_meal_plan(db, plan_id, UUID(current_user_id))

    if not meal_plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meal plan not found",
        )

    return MealPlanResponse.model_validate(meal_plan)


@router.put("/{plan_id}", response_model=MealPlanResponse)
async def update_meal_plan(
    plan_id: UUID,
    request: MealPlanUpdate,
    db: Session = Depends(get_db),
    current_user_id: str = Depends(get_current_user_id),
) -> MealPlanResponse:
    """
    Update an existing meal plan. Validates ownership via JWT.
    """
    meal_plan = meal_plan_service.update_meal_plan(
        db, plan_id, UUID(current_user_id), request
    )

    if not meal_plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meal plan not found",
        )

    return MealPlanResponse.model_validate(meal_plan)


@router.delete("/{plan_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_meal_plan(
    plan_id: UUID,
    db: Session = Depends(get_db),
    current_user_id: str = Depends(get_current_user_id),
) -> None:
    """
    Delete a meal plan. Validates ownership via JWT.
    """
    success = meal_plan_service.delete_meal_plan(db, plan_id, UUID(current_user_id))

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meal plan not found",
        )


@router.get("/{plan_id}/pdf")
async def export_meal_plan_pdf(
    plan_id: UUID,
    db: Session = Depends(get_db),
    current_user_id: str = Depends(get_current_user_id),
):
    """
    Export a meal plan as a PDF document.
    """
    meal_plan = meal_plan_service.get_meal_plan(db, plan_id, UUID(current_user_id))

    if not meal_plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meal plan not found",
        )

    pdf_bytes = generate_meal_plan_pdf(meal_plan)

    filename = f"plano-alimentar-{meal_plan.plan_name.replace(' ', '-').lower()}.pdf"

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
