"""
Tests for tracking service

To run these tests:
1. Install test dependencies: pip install pytest pytest-asyncio httpx
2. Run: pytest tests/test_tracking_service.py -v
"""
from datetime import date, datetime, timedelta
from decimal import Decimal
from uuid import uuid4

import pytest
from sqlmodel import Session

from app.models.tracking import MealLog, MealType
from app.schemas.tracking import FoodLogItem, MealLogRequest
from app.services import tracking_service


class TestLogMeal:
    """Tests for log_meal function"""

    def test_log_meal_success(self, session: Session, sample_food, sample_user):
        """Test successfully logging a meal"""
        # Arrange
        request = MealLogRequest(
            user_id=sample_user.user_id,
            meal_type=MealType.BREAKFAST,
            foods=[
                FoodLogItem(
                    food_id=sample_food.id,
                    quantity_g=Decimal("150"),
                    name="Chicken Breast"
                )
            ],
            notes="Post-workout meal",
        )

        # Act
        meal_log = tracking_service.log_meal(session, request)

        # Assert
        assert meal_log.id is not None
        assert meal_log.user_id == sample_user.user_id
        assert meal_log.meal_type == MealType.BREAKFAST
        assert len(meal_log.foods) == 1
        assert meal_log.total_calories > 0
        assert meal_log.total_protein_g > 0
        assert meal_log.notes == "Post-workout meal"

    def test_log_meal_calculates_nutrition_correctly(
        self, session: Session, sample_food, sample_user
    ):
        """Test that nutrition is calculated correctly"""
        # Arrange
        quantity = Decimal("200")  # 200g
        request = MealLogRequest(
            user_id=sample_user.user_id,
            meal_type=MealType.LUNCH,
            foods=[
                FoodLogItem(
                    food_id=sample_food.id,
                    quantity_g=quantity,
                    name="Chicken Breast"
                )
            ],
        )

        # Act
        meal_log = tracking_service.log_meal(session, request)

        # Assert
        # 200g of chicken breast: 165 * 2 = 330 calories, 31 * 2 = 62g protein
        assert abs(meal_log.total_calories - 330.0) < 1.0
        assert abs(meal_log.total_protein_g - 62.0) < 1.0

    def test_log_meal_updates_daily_stats(
        self, session: Session, sample_food, sample_user
    ):
        """Test that daily stats are updated after logging a meal"""
        # Arrange
        request = MealLogRequest(
            user_id=sample_user.user_id,
            meal_type=MealType.DINNER,
            foods=[
                FoodLogItem(
                    food_id=sample_food.id,
                    quantity_g=Decimal("150"),
                    name="Chicken Breast"
                )
            ],
        )

        # Act
        meal_log = tracking_service.log_meal(session, request)

        # Assert - Check that daily stats were created/updated
        summary = tracking_service.get_daily_summary(
            session, sample_user.user_id, date.today()
        )
        assert summary.num_meals == 1
        assert summary.totals["calories"] > 0


class TestGetDailySummary:
    """Tests for get_daily_summary function"""

    def test_get_daily_summary_empty_day(self, session: Session, sample_user):
        """Test getting summary for a day with no meals"""
        # Act
        summary = tracking_service.get_daily_summary(
            session, sample_user.user_id, date.today()
        )

        # Assert
        assert summary.num_meals == 0
        assert summary.totals["calories"] == 0
        assert len(summary.meals) == 0

    def test_get_daily_summary_with_meals(
        self, session: Session, sample_food, sample_user
    ):
        """Test getting summary for a day with meals"""
        # Arrange - Log 2 meals
        for meal_type in [MealType.BREAKFAST, MealType.LUNCH]:
            request = MealLogRequest(
                user_id=sample_user.user_id,
                meal_type=meal_type,
                foods=[
                    FoodLogItem(
                        food_id=sample_food.id,
                        quantity_g=Decimal("150"),
                        name="Chicken Breast"
                    )
                ],
            )
            tracking_service.log_meal(session, request)

        # Act
        summary = tracking_service.get_daily_summary(
            session, sample_user.user_id, date.today()
        )

        # Assert
        assert summary.num_meals == 2
        assert summary.totals["calories"] > 0
        assert len(summary.meals) == 2

    def test_get_daily_summary_progress_calculation(
        self, session: Session, sample_food, sample_user
    ):
        """Test that progress percentages are calculated correctly"""
        # Arrange - Log a meal
        request = MealLogRequest(
            user_id=sample_user.user_id,
            meal_type=MealType.BREAKFAST,
            foods=[
                FoodLogItem(
                    food_id=sample_food.id,
                    quantity_g=Decimal("150"),
                    name="Chicken Breast"
                )
            ],
        )
        tracking_service.log_meal(session, request)

        # Act
        summary = tracking_service.get_daily_summary(
            session, sample_user.user_id, date.today()
        )

        # Assert
        assert summary.progress.calories_pct >= 0
        assert summary.progress.protein_pct >= 0
        assert summary.progress.carbs_pct >= 0
        assert summary.progress.fat_pct >= 0


class TestGetWeeklyStats:
    """Tests for get_weekly_stats function"""

    def test_get_weekly_stats_no_data(self, session: Session, sample_user):
        """Test getting weekly stats with no logged meals"""
        # Act
        stats = tracking_service.get_weekly_stats(session, sample_user.user_id, days=7)

        # Assert
        assert stats.user_id == sample_user.user_id
        assert len(stats.stats) == 0
        assert stats.averages["calories"] == 0
        assert stats.adherence_rate == 0

    def test_get_weekly_stats_with_data(
        self, session: Session, sample_food, sample_user
    ):
        """Test getting weekly stats with logged meals"""
        # Arrange - Log meals for today
        request = MealLogRequest(
            user_id=sample_user.user_id,
            meal_type=MealType.BREAKFAST,
            foods=[
                FoodLogItem(
                    food_id=sample_food.id,
                    quantity_g=Decimal("150"),
                    name="Chicken Breast"
                )
            ],
        )
        tracking_service.log_meal(session, request)

        # Act
        stats = tracking_service.get_weekly_stats(session, sample_user.user_id, days=7)

        # Assert
        assert stats.user_id == sample_user.user_id
        assert len(stats.stats) >= 1
        assert stats.averages["calories"] > 0

    def test_get_weekly_stats_adherence_rate(
        self, session: Session, sample_food, sample_user
    ):
        """Test adherence rate calculation"""
        # Arrange - Log meals for 3 out of 7 days
        for i in range(3):
            consumed_at = datetime.now() - timedelta(days=i)
            request = MealLogRequest(
                user_id=sample_user.user_id,
                meal_type=MealType.BREAKFAST,
                foods=[
                    FoodLogItem(
                        food_id=sample_food.id,
                        quantity_g=Decimal("150"),
                        name="Chicken Breast"
                    )
                ],
                consumed_at=consumed_at,
            )
            tracking_service.log_meal(session, request)

        # Act
        stats = tracking_service.get_weekly_stats(session, sample_user.user_id, days=7)

        # Assert
        # Should have data for 3 days out of 7 = ~42.8% adherence
        assert 40 <= stats.adherence_rate <= 50
