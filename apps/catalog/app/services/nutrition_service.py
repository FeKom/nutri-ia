from decimal import Decimal
from typing import List
from uuid import UUID

from sqlmodel import Session, select

from app.models.food import Food, FoodNutrient
from app.schemas.food import (
    FoodQuantity,
    NutritionDetail,
    NutritionTotals,
)


def validate_food_ids(session: Session, food_ids: List[UUID]) -> tuple[bool, List[UUID]]:
    """
    Validate that all food IDs exist in the database

    Args:
        session: Database session
        food_ids: List of food IDs to validate

    Returns:
        Tuple of (all_exist: bool, missing_ids: List[UUID])
    """
    statement = select(Food.id).where(Food.id.in_(food_ids))  # type: ignore[union-attr]
    existing_ids = set(session.exec(statement).all())
    missing_ids = [fid for fid in food_ids if fid not in existing_ids]

    return len(missing_ids) == 0, missing_ids


def calculate_nutrition(
    session: Session, food_quantities: List[FoodQuantity]
) -> tuple[NutritionTotals, List[NutritionDetail]]:
    """
    Calculate total nutrition for a list of foods with quantities
    Args:
        session: Database session
        food_quantities: List of foods with their quantities in grams
    Returns:
        Tuple of (NutritionTotals, List[NutritionDetail])
    """

    food_ids = [fq.food_id for fq in food_quantities]

    statement = (
        select(Food, FoodNutrient)
        .join(FoodNutrient, Food.id == FoodNutrient.food_id, isouter=True)  # type: ignore[arg-type]
        .where(Food.id.in_(food_ids))  # type: ignore[union-attr]
    )
    results = session.exec(statement).all()
    food_map = {food.id: (food, nutrients) for food, nutrients in results}

    totals = NutritionTotals()
    details = []

    for fq in food_quantities:
        food, nutrients = food_map.get(fq.food_id, (None, None))

        if not food:
            continue

        multiplier = fq.quantity / Decimal("100")

        calories = Decimal("0")
        protein = Decimal("0")
        carbs = Decimal("0")
        fat = Decimal("0")
        saturated_fat = Decimal("0")
        fiber = Decimal("0")
        sugar = Decimal("0")
        sodium = Decimal("0")
        calcium = Decimal("0")
        iron = Decimal("0")
        vitamin_c = Decimal("0")

        if nutrients:
            calories = (nutrients.calories_100g or Decimal("0")) * multiplier
            protein = (nutrients.protein_g_100g or Decimal("0")) * multiplier
            carbs = (nutrients.carbs_g_100g or Decimal("0")) * multiplier
            fat = (nutrients.fat_g_100g or Decimal("0")) * multiplier
            saturated_fat = (
                nutrients.saturated_fat_g_100g or Decimal("0")
            ) * multiplier
            fiber = (nutrients.fiber_g_100g or Decimal("0")) * multiplier
            sugar = (nutrients.sugar_g_100g or Decimal("0")) * multiplier
            sodium = (nutrients.sodium_mg_100g or Decimal("0")) * multiplier
            calcium = (nutrients.calcium_mg_100g or Decimal("0")) * multiplier
            iron = (nutrients.iron_mg_100g or Decimal("0")) * multiplier
            vitamin_c = (nutrients.vitamin_c_mg_100g or Decimal("0")) * multiplier
        elif food.calorie_per_100g:
            # Fallback to food's calorie_per_100g if nutrients not available
            calories = food.calorie_per_100g * multiplier

            # Add to totals
        totals.calories += calories
        totals.protein_g += protein
        totals.carbs_g += carbs
        totals.fat_g += fat
        totals.saturated_fat_g += saturated_fat
        totals.fiber_g += fiber
        totals.sugar_g += sugar
        totals.sodium_mg += sodium
        totals.calcium_mg += calcium
        totals.iron_mg += iron
        totals.vitamin_c_mg += vitamin_c

        # Add to details
        details.append(
            NutritionDetail(
                food_id=food.id,
                food_name=food.name,
                quantity_g=fq.quantity,
                calories=calories,
                protein_g=protein,
                carbs_g=carbs,
                fat_g=fat,
            )
        )

    return totals, details


def get_nutrient_by_food_id(session: Session, food_id: UUID) -> FoodNutrient | None:
    """
    Get nutrient information for a specific food

    Args:
        session: Database session
        food_id: UUID of the food item

    Returns:
        FoodNutrient object if found, None otherwise
    """
    statement = select(FoodNutrient).where(FoodNutrient.food_id == food_id)
    return session.exec(statement).first()
