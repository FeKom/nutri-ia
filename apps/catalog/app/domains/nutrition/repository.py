from decimal import Decimal
from typing import List, Protocol, Tuple
from uuid import UUID

from sqlmodel import Session, select

from app.models.food import Food, FoodNutrient
from app.schemas.food import FoodQuantity, NutritionDetail, NutritionTotals


class NutritionRepository(Protocol):
    def validate_food_ids(self, food_ids: List[UUID]) -> Tuple[bool, List[UUID]]: ...
    def calculate_nutrition(
        self, food_quantities: List[FoodQuantity]
    ) -> Tuple[NutritionTotals, List[NutritionDetail]]: ...
    def get_nutrient_by_food_id(self, food_id: UUID): ...


class SQLModelNutritionRepository:
    def __init__(self, session: Session) -> None:
        self._s = session

    def validate_food_ids(self, food_ids: List[UUID]) -> Tuple[bool, List[UUID]]:
        existing = set(self._s.exec(select(Food.id).where(Food.id.in_(food_ids))).all())
        missing = [fid for fid in food_ids if fid not in existing]
        return len(missing) == 0, missing

    def calculate_nutrition(
        self, food_quantities: List[FoodQuantity]
    ) -> Tuple[NutritionTotals, List[NutritionDetail]]:
        food_ids = [fq.food_id for fq in food_quantities]
        rows = self._s.exec(
            select(Food, FoodNutrient)
            .join(FoodNutrient, Food.id == FoodNutrient.food_id, isouter=True)
            .where(Food.id.in_(food_ids))
        ).all()
        food_map = {food.id: (food, nutrients) for food, nutrients in rows}

        totals = NutritionTotals()
        details = []
        for fq in food_quantities:
            food, nutrients = food_map.get(fq.food_id, (None, None))
            if not food:
                continue
            m = fq.quantity / Decimal("100")
            z = Decimal("0")
            cal = (
                (nutrients.calories_100g or z) * m
                if nutrients
                else (food.calorie_per_100g or z) * m
            )
            prot = (nutrients.protein_g_100g or z) * m if nutrients else z
            carbs = (nutrients.carbs_g_100g or z) * m if nutrients else z
            fat = (nutrients.fat_g_100g or z) * m if nutrients else z
            totals.calories += cal
            totals.protein_g += prot
            totals.carbs_g += carbs
            totals.fat_g += fat
            if nutrients:
                totals.saturated_fat_g += (nutrients.saturated_fat_g_100g or z) * m
                totals.fiber_g += (nutrients.fiber_g_100g or z) * m
                totals.sugar_g += (nutrients.sugar_g_100g or z) * m
                totals.sodium_mg += (nutrients.sodium_mg_100g or z) * m
                totals.calcium_mg += (nutrients.calcium_mg_100g or z) * m
                totals.iron_mg += (nutrients.iron_mg_100g or z) * m
                totals.vitamin_c_mg += (nutrients.vitamin_c_mg_100g or z) * m
            details.append(
                NutritionDetail(
                    food_id=food.id,
                    food_name=food.name,
                    quantity_g=fq.quantity,
                    calories=cal,
                    protein_g=prot,
                    carbs_g=carbs,
                    fat_g=fat,
                )
            )
        return totals, details

    def get_nutrient_by_food_id(self, food_id: UUID):
        return self._s.exec(
            select(FoodNutrient).where(FoodNutrient.food_id == food_id)
        ).first()
