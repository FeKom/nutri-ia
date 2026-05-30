from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

from app.api.dependencies import get_db
from app.domains.nutrition.exceptions import FoodsNotFoundError
from app.domains.nutrition.repository import SQLModelNutritionRepository
from app.schemas.food import (
    MacrosProfileUsed,
    MacrosRequest,
    MacrosResponse,
    NutritionCalculationRequest,
    NutritionCalculationResponse,
)
from app.services.nutrition_calculator import (
    ACTIVITY_MULTIPLIERS,
    GOAL_CALORIE_ADJUSTMENT,
    GOAL_MACRO_SPLITS,
    MIN_CALORIES,
    _calculate_bmr,
)

router = APIRouter()


def _get_repo(session: Session = Depends(get_db)) -> SQLModelNutritionRepository:
    return SQLModelNutritionRepository(session)


_Repo = Annotated[SQLModelNutritionRepository, Depends(_get_repo)]


@router.post("/calculate", response_model=NutritionCalculationResponse)
async def calculate_nutrition(
    request: NutritionCalculationRequest, repo: _Repo
) -> NutritionCalculationResponse:
    food_ids = [fq.food_id for fq in request.foods]
    ok, missing = repo.validate_food_ids(food_ids)
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Foods not found: {[str(i) for i in missing]}",
        )
    totals, details = repo.calculate_nutrition(request.foods)
    return NutritionCalculationResponse(success=True, total=totals, details=details)


@router.post("/macros", response_model=MacrosResponse)
async def calculate_macros(request: MacrosRequest) -> MacrosResponse:
    bmr = _calculate_bmr(
        request.weight_kg, request.height_cm, request.age, request.gender.value
    )
    tdee = bmr * ACTIVITY_MULTIPLIERS.get(request.activity_level.value, 1.55)
    target_cal = max(
        tdee + GOAL_CALORIE_ADJUSTMENT.get(request.diet_goal.value, 0), MIN_CALORIES
    )
    prot_pct, carb_pct, fat_pct = GOAL_MACRO_SPLITS.get(
        request.diet_goal.value, (0.30, 0.40, 0.30)
    )
    return MacrosResponse(
        tmb=round(bmr, 1),
        tdee=round(tdee, 1),
        daily_calories=round(target_cal, 0),
        daily_protein_g=round(target_cal * prot_pct / 4, 1),
        daily_carbs_g=round(target_cal * carb_pct / 4, 1),
        daily_fat_g=round(target_cal * fat_pct / 9, 1),
        calorie_adjustment=GOAL_CALORIE_ADJUSTMENT.get(request.diet_goal.value, 0),
        diet_goal=request.diet_goal.value,
        profile_used=MacrosProfileUsed(
            weight_kg=request.weight_kg,
            height_cm=request.height_cm,
            age=request.age,
            gender=request.gender.value,
            activity_level=request.activity_level.value,
            diet_goal=request.diet_goal.value,
        ),
        explanation=(
            f"BMR calculado com Mifflin-St Jeor: {bmr:.0f} kcal/dia. "
            f"TDEE com fator de atividade ({request.activity_level.value}): {tdee:.0f} kcal/dia. "
            f"Meta ({request.diet_goal.value}): {target_cal:.0f} kcal/dia."
        ),
    )
