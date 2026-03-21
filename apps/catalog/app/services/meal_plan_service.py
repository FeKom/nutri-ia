from datetime import datetime
from typing import Optional
from uuid import UUID

from sqlalchemy import func
from sqlmodel import Session, select

from app.models.user import MealPlan
from app.schemas.meal_plan import (
    MealPlanCreate,
    MealPlanListResponse,
    MealPlanResponse,
    MealPlanUpdate,
)


def create_meal_plan(session: Session, user_id: UUID, data: MealPlanCreate) -> MealPlan:
    """
    Create a new meal plan for a user

    Args:
        session: Database session
        user_id: UUID of the user
        data: Meal plan creation data

    Returns:
        Created MealPlan object
    """
    meal_plan = MealPlan(
        user_id=user_id,
        plan_name=data.plan_name,
        description=data.description,
        daily_calories=data.daily_calories,
        daily_protein_g=data.daily_protein_g,
        daily_fat_g=data.daily_fat_g,
        daily_carbs_g=data.daily_carbs_g,
        created_by=data.created_by,
        meals=data.meals or [],
    )

    session.add(meal_plan)
    session.commit()
    session.refresh(meal_plan)

    return meal_plan


def list_meal_plans(
    session: Session, user_id: UUID, page: int = 1, page_size: int = 10
) -> MealPlanListResponse:
    """
    List all meal plans for a user with pagination

    Args:
        session: Database session
        user_id: UUID of the user
        page: Page number (starts at 1)
        page_size: Number of items per page

    Returns:
        Paginated list of meal plans
    """
    offset = (page - 1) * page_size

    # Get total count
    count_statement = select(func.count()).select_from(MealPlan).where(MealPlan.user_id == user_id)
    total = session.exec(count_statement).one()

    # Get paginated plans
    statement = (
        select(MealPlan)
        .where(MealPlan.user_id == user_id)
        .order_by(MealPlan.created_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    plans = session.exec(statement).all()

    return MealPlanListResponse(
        plans=[MealPlanResponse.model_validate(p) for p in plans],
        total=total,
        page=page,
        page_size=page_size,
    )


def get_meal_plan(session: Session, plan_id: UUID, user_id: UUID) -> Optional[MealPlan]:
    """
    Get a specific meal plan by ID

    Args:
        session: Database session
        plan_id: UUID of the meal plan
        user_id: UUID of the user (for ownership validation)

    Returns:
        MealPlan object or None if not found
    """
    statement = select(MealPlan).where(MealPlan.id == plan_id, MealPlan.user_id == user_id)
    return session.exec(statement).first()


def update_meal_plan(
    session: Session, plan_id: UUID, user_id: UUID, data: MealPlanUpdate
) -> Optional[MealPlan]:
    """
    Update an existing meal plan

    Args:
        session: Database session
        plan_id: UUID of the meal plan
        user_id: UUID of the user (for ownership validation)
        data: Update data

    Returns:
        Updated MealPlan object or None if not found
    """
    meal_plan = get_meal_plan(session, plan_id, user_id)

    if not meal_plan:
        return None

    # Update only provided fields
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(meal_plan, field, value)

    meal_plan.updated_at = datetime.utcnow()

    session.add(meal_plan)
    session.commit()
    session.refresh(meal_plan)

    return meal_plan


def delete_meal_plan(session: Session, plan_id: UUID, user_id: UUID) -> bool:
    """
    Delete a meal plan

    Args:
        session: Database session
        plan_id: UUID of the meal plan
        user_id: UUID of the user (for ownership validation)

    Returns:
        True if deleted, False if not found
    """
    meal_plan = get_meal_plan(session, plan_id, user_id)

    if not meal_plan:
        return False

    session.delete(meal_plan)
    session.commit()

    return True
