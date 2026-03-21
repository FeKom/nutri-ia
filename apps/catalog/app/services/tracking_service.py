from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Dict, List, Optional
from uuid import UUID

from sqlalchemy import func
from sqlmodel import Session, select

from app.models.tracking import DailyStats, MealLog, MealType
from app.models.user import UserProfile
from app.schemas.food import FoodQuantity, NutritionTotals
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


def log_meal(session: Session, request: MealLogRequest) -> MealLog:
    """
    Register a meal consumed by the user

    Args:
        session: Database session
        request: Meal log request with foods and quantities

    Returns:
        Created MealLog object

    Raises:
        ValueError: If any food_id doesn't exist or quantities are invalid
    """
    # Validate food IDs exist
    food_ids = [food.food_id for food in request.foods]
    all_exist, missing_ids = validate_food_ids(session, food_ids)

    if not all_exist:
        raise ValueError(
            f"Os seguintes alimentos não foram encontrados: {', '.join(str(id) for id in missing_ids)}"
        )

    # Validate quantities are reasonable (max 10kg per food item)
    MAX_QUANTITY = 10000  # 10kg in grams
    for food in request.foods:
        if food.quantity_g > MAX_QUANTITY:
            raise ValueError(
                f"Quantidade muito alta: {food.quantity_g}g. Máximo permitido: {MAX_QUANTITY}g (10kg)"
            )

    # Convert FoodLogItem to FoodQuantity for nutrition calculation
    food_quantities = [
        FoodQuantity(food_id=food.food_id, quantity=food.quantity_g)
        for food in request.foods
    ]

    # Calculate total nutrition
    totals, details = calculate_nutrition(session, food_quantities)

    # Convert foods to dict format for storage
    foods_dict = [
        {
            "food_id": str(food.food_id),
            "quantity_g": float(food.quantity_g),
            "name": food.name or "",
        }
        for food in request.foods
    ]

    # Create meal log
    meal_log = MealLog(
        user_id=request.user_id,
        consumed_at=request.consumed_at or datetime.utcnow(),
        meal_type=request.meal_type,
        foods=foods_dict,
        total_calories=float(totals.calories),
        total_protein_g=float(totals.protein_g),
        total_carbs_g=float(totals.carbs_g),
        total_fat_g=float(totals.fat_g),
        total_fiber_g=float(totals.fiber_g) if totals.fiber_g else None,
        total_sodium_mg=float(totals.sodium_mg) if totals.sodium_mg else None,
        notes=request.notes,
    )

    session.add(meal_log)

    try:
        # Flush to get the meal_log ID without committing
        session.flush()

        # Update daily stats within the same transaction
        _update_daily_stats(session, request.user_id, meal_log.consumed_at.date())

        # Single commit for both meal log and daily stats
        session.commit()
        session.refresh(meal_log)
    except Exception:
        session.rollback()
        raise

    return meal_log


def update_meal(
    session: Session, meal_id: UUID, user_id: UUID, updates: MealLogUpdate
) -> Optional[MealLog]:
    """
    Update an existing meal log entry

    Args:
        session: Database session
        meal_id: ID of the meal log to update
        user_id: UUID of the authenticated user (for ownership validation)
        updates: Partial update data

    Returns:
        Updated MealLog object or None if not found/unauthorized
    """
    # Get existing meal log
    meal_log = session.get(MealLog, meal_id)

    if not meal_log or meal_log.user_id != user_id:
        return None

    # Store original date for stats recalculation
    original_date = meal_log.consumed_at.date()

    try:
        # Update simple fields
        update_data = updates.model_dump(exclude_unset=True, exclude={"foods"})
        for field, value in update_data.items():
            setattr(meal_log, field, value)

        # If foods were updated, recalculate nutrition
        if updates.foods is not None:
            # Validate food IDs exist
            food_ids = [food.food_id for food in updates.foods]
            all_exist, missing_ids = validate_food_ids(session, food_ids)

            if not all_exist:
                raise ValueError(
                    f"Os seguintes alimentos não foram encontrados: {', '.join(str(id) for id in missing_ids)}"
                )

            # Validate quantities are reasonable
            MAX_QUANTITY = 10000  # 10kg in grams
            for food in updates.foods:
                if food.quantity_g > MAX_QUANTITY:
                    raise ValueError(
                        f"Quantidade muito alta: {food.quantity_g}g. Máximo permitido: {MAX_QUANTITY}g (10kg)"
                    )

            food_quantities = [
                FoodQuantity(food_id=food.food_id, quantity=food.quantity_g)
                for food in updates.foods
            ]

            totals, details = calculate_nutrition(session, food_quantities)

            foods_dict = [
                {
                    "food_id": str(food.food_id),
                    "quantity_g": float(food.quantity_g),
                    "name": food.name or "",
                }
                for food in updates.foods
            ]

            meal_log.foods = foods_dict
            meal_log.total_calories = float(totals.calories)
            meal_log.total_protein_g = float(totals.protein_g)
            meal_log.total_carbs_g = float(totals.carbs_g)
            meal_log.total_fat_g = float(totals.fat_g)
            meal_log.total_fiber_g = (
                float(totals.fiber_g) if totals.fiber_g else None
            )
            meal_log.total_sodium_mg = (
                float(totals.sodium_mg) if totals.sodium_mg else None
            )

        session.add(meal_log)
        session.flush()

        # Recalculate stats for both original and new dates (if date changed)
        new_date = meal_log.consumed_at.date()
        _update_daily_stats(session, user_id, original_date)
        if new_date != original_date:
            _update_daily_stats(session, user_id, new_date)

        session.commit()
        session.refresh(meal_log)

        return meal_log
    except Exception:
        session.rollback()
        raise


def delete_meal(session: Session, meal_id: UUID, user_id: UUID) -> bool:
    """
    Delete a meal log entry

    Args:
        session: Database session
        meal_id: ID of the meal log to delete
        user_id: UUID of the authenticated user (for ownership validation)

    Returns:
        True if deleted, False if not found/unauthorized
    """
    # Get existing meal log
    meal_log = session.get(MealLog, meal_id)

    if not meal_log or meal_log.user_id != user_id:
        return False

    meal_date = meal_log.consumed_at.date()

    try:
        session.delete(meal_log)
        session.flush()

        # Recalculate daily stats for the date
        _update_daily_stats(session, user_id, meal_date)

        session.commit()
        return True
    except Exception:
        session.rollback()
        raise


def get_daily_summary(
    session: Session, user_id: UUID, target_date: date
) -> DailySummaryResponse:
    """
    Get daily nutrition summary for a user

    Args:
        session: Database session
        user_id: UUID of the user
        target_date: Date to get summary for

    Returns:
        Daily summary with meals, totals, targets, and progress
    """
    # Get all meals for the day
    statement = (
        select(MealLog)
        .where(MealLog.user_id == user_id)
        .where(func.date(MealLog.consumed_at) == target_date)
        .order_by(MealLog.consumed_at)
    )
    meals = session.exec(statement).all()

    # Calculate totals
    total_calories = sum(m.total_calories for m in meals)
    total_protein = sum(m.total_protein_g for m in meals)
    total_carbs = sum(m.total_carbs_g for m in meals)
    total_fat = sum(m.total_fat_g for m in meals)
    total_fiber = sum(m.total_fiber_g or 0 for m in meals)
    total_sodium = sum(m.total_sodium_mg or 0 for m in meals)

    # Get user profile for targets
    profile = session.exec(
        select(UserProfile).where(UserProfile.user_id == user_id)
    ).first()

    # Calculate personalized targets from profile
    if profile:
        targets = calculate_targets(profile)
    else:
        targets = DEFAULT_TARGETS

    target_calories = targets.calories
    target_protein = targets.protein_g
    target_carbs = targets.carbs_g
    target_fat = targets.fat_g

    # Calculate progress percentages
    progress = NutritionProgress(
        calories_pct=(total_calories / target_calories * 100) if target_calories else 0,
        protein_pct=(total_protein / target_protein * 100) if target_protein else 0,
        carbs_pct=(total_carbs / target_carbs * 100) if target_carbs else 0,
        fat_pct=(total_fat / target_fat * 100) if target_fat else 0,
    )

    # Create meal summaries
    meal_summaries = [
        MealSummary(
            id=meal.id,
            meal_type=meal.meal_type,
            consumed_at=meal.consumed_at,
            total_calories=meal.total_calories,
            total_protein_g=meal.total_protein_g,
            total_carbs_g=meal.total_carbs_g,
            total_fat_g=meal.total_fat_g,
            num_foods=len(meal.foods),
            notes=meal.notes,
        )
        for meal in meals
    ]

    return DailySummaryResponse(
        date=target_date,
        meals=meal_summaries,
        totals={
            "calories": total_calories,
            "protein_g": total_protein,
            "carbs_g": total_carbs,
            "fat_g": total_fat,
            "fiber_g": total_fiber,
            "sodium_mg": total_sodium,
        },
        targets={
            "calories": target_calories,
            "protein_g": target_protein,
            "carbs_g": target_carbs,
            "fat_g": target_fat,
        },
        progress=progress,
        num_meals=len(meals),
    )


def get_weekly_stats(
    session: Session, user_id: UUID, days: int = 7
) -> WeeklyStatsResponse:
    """
    Get weekly nutrition statistics

    Args:
        session: Database session
        user_id: UUID of the user
        days: Number of days to include (default 7)

    Returns:
        Weekly stats with daily breakdown and averages
    """
    end_date = date.today()
    start_date = end_date - timedelta(days=days - 1)

    # Get daily stats for the period
    statement = (
        select(DailyStats)
        .where(DailyStats.user_id == user_id)
        .where(DailyStats.date >= start_date)
        .where(DailyStats.date <= end_date)
        .order_by(DailyStats.date)
    )
    daily_stats = session.exec(statement).all()

    # Create day stats list
    stats_list = [
        DayStats(
            date=stat.date,
            total_calories=stat.total_calories,
            total_protein_g=stat.total_protein_g,
            total_carbs_g=stat.total_carbs_g,
            total_fat_g=stat.total_fat_g,
            num_meals=stat.num_meals,
            target_calories=stat.target_calories,
            target_protein_g=stat.target_protein_g,
        )
        for stat in daily_stats
    ]

    # Calculate averages
    num_days_with_data = len(daily_stats)
    if num_days_with_data > 0:
        avg_calories = sum(s.total_calories for s in daily_stats) / num_days_with_data
        avg_protein = sum(s.total_protein_g for s in daily_stats) / num_days_with_data
        avg_carbs = sum(s.total_carbs_g for s in daily_stats) / num_days_with_data
        avg_fat = sum(s.total_fat_g for s in daily_stats) / num_days_with_data
        adherence_rate = (num_days_with_data / days) * 100
    else:
        avg_calories = avg_protein = avg_carbs = avg_fat = 0
        adherence_rate = 0

    return WeeklyStatsResponse(
        user_id=user_id,
        stats=stats_list,
        averages={
            "calories": avg_calories,
            "protein_g": avg_protein,
            "carbs_g": avg_carbs,
            "fat_g": avg_fat,
        },
        adherence_rate=adherence_rate,
    )


def _update_daily_stats(session: Session, user_id: UUID, target_date: date) -> None:
    """
    Update or create daily stats for a given date

    Args:
        session: Database session
        user_id: UUID of the user
        target_date: Date to update stats for
    """
    # Get all meals for the day
    statement = (
        select(MealLog)
        .where(MealLog.user_id == user_id)
        .where(func.date(MealLog.consumed_at) == target_date)
    )
    meals = session.exec(statement).all()

    # Calculate totals
    total_calories = sum(m.total_calories for m in meals)
    total_protein = sum(m.total_protein_g for m in meals)
    total_carbs = sum(m.total_carbs_g for m in meals)
    total_fat = sum(m.total_fat_g for m in meals)
    total_fiber = sum(m.total_fiber_g or 0 for m in meals)
    total_sodium = sum(m.total_sodium_mg or 0 for m in meals)

    # Get user profile for targets
    profile = session.exec(
        select(UserProfile).where(UserProfile.user_id == user_id)
    ).first()

    # Get or create daily stats
    daily_stat = session.exec(
        select(DailyStats)
        .where(DailyStats.user_id == user_id)
        .where(DailyStats.date == target_date)
    ).first()

    # Calculate personalized targets
    if profile:
        targets = calculate_targets(profile)
    else:
        targets = DEFAULT_TARGETS

    if daily_stat:
        # Update existing
        daily_stat.total_calories = total_calories
        daily_stat.total_protein_g = total_protein
        daily_stat.total_carbs_g = total_carbs
        daily_stat.total_fat_g = total_fat
        daily_stat.total_fiber_g = total_fiber if total_fiber > 0 else None
        daily_stat.total_sodium_mg = total_sodium if total_sodium > 0 else None
        daily_stat.num_meals = len(meals)
        daily_stat.target_calories = targets.calories
        daily_stat.target_protein_g = targets.protein_g
        daily_stat.target_carbs_g = targets.carbs_g
        daily_stat.target_fat_g = targets.fat_g
        daily_stat.updated_at = datetime.utcnow()
    else:
        # Create new
        daily_stat = DailyStats(
            user_id=user_id,
            date=target_date,
            total_calories=total_calories,
            total_protein_g=total_protein,
            total_carbs_g=total_carbs,
            total_fat_g=total_fat,
            total_fiber_g=total_fiber if total_fiber > 0 else None,
            total_sodium_mg=total_sodium if total_sodium > 0 else None,
            num_meals=len(meals),
            target_calories=targets.calories,
            target_protein_g=targets.protein_g,
            target_carbs_g=targets.carbs_g,
            target_fat_g=targets.fat_g,
        )
        session.add(daily_stat)

    # Use flush instead of commit — the caller (log_meal) handles the final commit.
    # When called standalone (e.g. recalculation), the caller should commit.
    session.flush()
