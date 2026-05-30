from datetime import date, datetime, timedelta
from typing import List, Optional, Protocol, Tuple
from uuid import UUID

from sqlalchemy import func
from sqlmodel import Session, select

from app.domains.tracking.exceptions import InvalidFoodError, MealNotFoundError
from app.models.tracking import DailyStats, MealLog, MealType
from app.models.user import UserProfile
from app.schemas.food import FoodQuantity
from app.schemas.tracking import (
    DailySummaryResponse,
    DayStats,
    MealLogRequest,
    MealLogUpdate,
    MealSummary,
    NutritionProgress,
    WeeklyStatsResponse,
)
from app.services.nutrition_calculator import DEFAULT_TARGETS, calculate_targets
from app.services.nutrition_service import calculate_nutrition, validate_food_ids


class TrackingRepository(Protocol):
    def log_meal(self, request: MealLogRequest) -> MealLog: ...
    def update_meal(
        self, meal_id: UUID, user_id: UUID, updates: MealLogUpdate
    ) -> MealLog: ...
    def delete_meal(self, meal_id: UUID, user_id: UUID) -> None: ...
    def get_daily_summary(
        self, user_id: UUID, target_date: date
    ) -> DailySummaryResponse: ...
    def get_weekly_stats(self, user_id: UUID, days: int) -> WeeklyStatsResponse: ...


class SQLModelTrackingRepository:
    def __init__(self, session: Session) -> None:
        self._s = session

    def log_meal(self, request: MealLogRequest) -> MealLog:
        food_ids = [f.food_id for f in request.foods]
        ok, missing = validate_food_ids(self._s, food_ids)
        if not ok:
            raise InvalidFoodError(missing)

        MAX_QTY = 10000
        for f in request.foods:
            if f.quantity_g > MAX_QTY:
                raise ValueError(f"Quantidade muito alta: {f.quantity_g}g")

        quantities = [
            FoodQuantity(food_id=f.food_id, quantity=f.quantity_g)
            for f in request.foods
        ]
        totals, _ = calculate_nutrition(self._s, quantities)

        meal = MealLog(
            user_id=request.user_id,
            consumed_at=request.consumed_at or datetime.utcnow(),
            meal_type=request.meal_type,
            foods=[
                {
                    "food_id": str(f.food_id),
                    "quantity_g": float(f.quantity_g),
                    "name": f.name or "",
                }
                for f in request.foods
            ],
            total_calories=float(totals.calories),
            total_protein_g=float(totals.protein_g),
            total_carbs_g=float(totals.carbs_g),
            total_fat_g=float(totals.fat_g),
            total_fiber_g=float(totals.fiber_g) if totals.fiber_g else None,
            total_sodium_mg=float(totals.sodium_mg) if totals.sodium_mg else None,
            notes=request.notes,
        )
        self._s.add(meal)
        try:
            self._s.flush()
            self._update_daily_stats(request.user_id, meal.consumed_at.date())
            self._s.commit()
            self._s.refresh(meal)
        except Exception:
            self._s.rollback()
            raise
        return meal

    def update_meal(
        self, meal_id: UUID, user_id: UUID, updates: MealLogUpdate
    ) -> MealLog:
        meal = self._s.get(MealLog, meal_id)
        if not meal or meal.user_id != user_id:
            raise MealNotFoundError(meal_id)
        original_date = meal.consumed_at.date()
        try:
            for k, v in updates.model_dump(
                exclude_unset=True, exclude={"foods"}
            ).items():
                setattr(meal, k, v)
            if updates.foods is not None:
                food_ids = [f.food_id for f in updates.foods]
                ok, missing = validate_food_ids(self._s, food_ids)
                if not ok:
                    raise InvalidFoodError(missing)
                quantities = [
                    FoodQuantity(food_id=f.food_id, quantity=f.quantity_g)
                    for f in updates.foods
                ]
                totals, _ = calculate_nutrition(self._s, quantities)
                meal.foods = [
                    {
                        "food_id": str(f.food_id),
                        "quantity_g": float(f.quantity_g),
                        "name": f.name or "",
                    }
                    for f in updates.foods
                ]
                meal.total_calories = float(totals.calories)
                meal.total_protein_g = float(totals.protein_g)
                meal.total_carbs_g = float(totals.carbs_g)
                meal.total_fat_g = float(totals.fat_g)
                meal.total_fiber_g = float(totals.fiber_g) if totals.fiber_g else None
                meal.total_sodium_mg = (
                    float(totals.sodium_mg) if totals.sodium_mg else None
                )
            self._s.add(meal)
            self._s.flush()
            new_date = meal.consumed_at.date()
            self._update_daily_stats(user_id, original_date)
            if new_date != original_date:
                self._update_daily_stats(user_id, new_date)
            self._s.commit()
            self._s.refresh(meal)
        except Exception:
            self._s.rollback()
            raise
        return meal

    def delete_meal(self, meal_id: UUID, user_id: UUID) -> None:
        meal = self._s.get(MealLog, meal_id)
        if not meal or meal.user_id != user_id:
            raise MealNotFoundError(meal_id)
        meal_date = meal.consumed_at.date()
        try:
            self._s.delete(meal)
            self._s.flush()
            self._update_daily_stats(user_id, meal_date)
            self._s.commit()
        except Exception:
            self._s.rollback()
            raise

    def get_daily_summary(
        self, user_id: UUID, target_date: date
    ) -> DailySummaryResponse:
        meals = self._s.exec(
            select(MealLog)
            .where(MealLog.user_id == user_id)
            .where(func.date(MealLog.consumed_at) == target_date)
            .order_by(MealLog.consumed_at)
        ).all()
        profile = self._s.exec(
            select(UserProfile).where(UserProfile.user_id == user_id)
        ).first()
        targets = calculate_targets(profile) if profile else DEFAULT_TARGETS
        total_cal = sum(m.total_calories for m in meals)
        total_prot = sum(m.total_protein_g for m in meals)
        total_carbs = sum(m.total_carbs_g for m in meals)
        total_fat = sum(m.total_fat_g for m in meals)
        return DailySummaryResponse(
            date=target_date,
            meals=[
                MealSummary(
                    id=m.id,
                    meal_type=m.meal_type,
                    consumed_at=m.consumed_at,
                    total_calories=m.total_calories,
                    total_protein_g=m.total_protein_g,
                    total_carbs_g=m.total_carbs_g,
                    total_fat_g=m.total_fat_g,
                    num_foods=len(m.foods),
                    notes=m.notes,
                )
                for m in meals
            ],
            totals={
                "calories": total_cal,
                "protein_g": total_prot,
                "carbs_g": total_carbs,
                "fat_g": total_fat,
                "fiber_g": sum(m.total_fiber_g or 0 for m in meals),
                "sodium_mg": sum(m.total_sodium_mg or 0 for m in meals),
            },
            targets={
                "calories": targets.calories,
                "protein_g": targets.protein_g,
                "carbs_g": targets.carbs_g,
                "fat_g": targets.fat_g,
            },
            progress=NutritionProgress(
                calories_pct=(total_cal / targets.calories * 100)
                if targets.calories
                else 0,
                protein_pct=(total_prot / targets.protein_g * 100)
                if targets.protein_g
                else 0,
                carbs_pct=(total_carbs / targets.carbs_g * 100)
                if targets.carbs_g
                else 0,
                fat_pct=(total_fat / targets.fat_g * 100) if targets.fat_g else 0,
            ),
            num_meals=len(meals),
        )

    def get_weekly_stats(self, user_id: UUID, days: int = 7) -> WeeklyStatsResponse:
        end_date = datetime.utcnow().date()
        start_date = end_date - timedelta(days=days - 1)
        stats = self._s.exec(
            select(DailyStats)
            .where(DailyStats.user_id == user_id)
            .where(DailyStats.date >= start_date)
            .where(DailyStats.date <= end_date)
            .order_by(DailyStats.date)
        ).all()
        n = len(stats)
        avgs = {
            k: (sum(getattr(s, f"total_{k}") for s in stats) / n) if n else 0
            for k in ("calories", "protein_g", "carbs_g", "fat_g")
        }
        return WeeklyStatsResponse(
            user_id=user_id,
            stats=[
                DayStats(
                    date=s.date,
                    total_calories=s.total_calories,
                    total_protein_g=s.total_protein_g,
                    total_carbs_g=s.total_carbs_g,
                    total_fat_g=s.total_fat_g,
                    num_meals=s.num_meals,
                    target_calories=s.target_calories,
                    target_protein_g=s.target_protein_g,
                )
                for s in stats
            ],
            averages=avgs,
            adherence_rate=(n / days * 100),
        )

    def _update_daily_stats(self, user_id: UUID, target_date: date) -> None:
        meals = self._s.exec(
            select(MealLog)
            .where(MealLog.user_id == user_id)
            .where(func.date(MealLog.consumed_at) == target_date)
        ).all()
        profile = self._s.exec(
            select(UserProfile).where(UserProfile.user_id == user_id)
        ).first()
        targets = calculate_targets(profile) if profile else DEFAULT_TARGETS
        stat = self._s.exec(
            select(DailyStats).where(
                DailyStats.user_id == user_id, DailyStats.date == target_date
            )
        ).first()
        values = dict(
            total_calories=sum(m.total_calories for m in meals),
            total_protein_g=sum(m.total_protein_g for m in meals),
            total_carbs_g=sum(m.total_carbs_g for m in meals),
            total_fat_g=sum(m.total_fat_g for m in meals),
            total_fiber_g=sum(m.total_fiber_g or 0 for m in meals) or None,
            total_sodium_mg=sum(m.total_sodium_mg or 0 for m in meals) or None,
            num_meals=len(meals),
            target_calories=targets.calories,
            target_protein_g=targets.protein_g,
            target_carbs_g=targets.carbs_g,
            target_fat_g=targets.fat_g,
        )
        if stat:
            for k, v in values.items():
                setattr(stat, k, v)
            stat.updated_at = datetime.utcnow()
        else:
            stat = DailyStats(user_id=user_id, date=target_date, **values)
            self._s.add(stat)
        self._s.flush()
