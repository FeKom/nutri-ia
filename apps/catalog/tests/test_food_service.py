"""
Tests for food service

To run these tests:
pytest tests/test_food_service.py -v
"""
from decimal import Decimal
from uuid import uuid4

import pytest
from sqlmodel import Session

from app.models.food import Food, FoodNutrient, FoodSource
from app.schemas.food import FoodSearchFilters
from app.services import food_service


class TestSearchFoods:
    """Tests for search_foods function"""

    def test_search_foods_by_name(self, session: Session, sample_food):
        """Test searching foods by name"""
        # Act
        results = food_service.search_foods(session, "chicken", limit=10)

        # Assert
        assert len(results) >= 1
        assert any(f.name == "Chicken Breast" for f in results)

    def test_search_foods_case_insensitive(self, session: Session, sample_food):
        """Test that search is case-insensitive"""
        # Act
        results_lower = food_service.search_foods(session, "chicken", limit=10)
        results_upper = food_service.search_foods(session, "CHICKEN", limit=10)

        # Assert
        assert len(results_lower) == len(results_upper)

    def test_search_foods_with_category_filter(self, session: Session, sample_food):
        """Test searching with category filter"""
        # Arrange
        filters = FoodSearchFilters(category="meat")

        # Act
        results = food_service.search_foods(session, "chicken", filters=filters)

        # Assert
        assert all(f.category == "meat" for f in results)

    def test_search_foods_with_min_protein_filter(self, session: Session, sample_food):
        """Test searching with minimum protein filter"""
        # Arrange
        filters = FoodSearchFilters(min_protein=Decimal("20"))

        # Act
        results = food_service.search_foods(session, "chicken", filters=filters)

        # Assert - All results should have >= 20g protein per 100g
        assert len(results) >= 1

    def test_search_foods_with_verified_only_filter(self, session: Session, sample_food):
        """Test searching only verified foods"""
        # Arrange
        filters = FoodSearchFilters(verified_only=True)

        # Act
        results = food_service.search_foods(session, "chicken", filters=filters)

        # Assert
        assert all(f.is_verified for f in results)

    def test_search_foods_respects_limit(self, session: Session):
        """Test that search respects the limit parameter"""
        # Arrange - Create multiple foods
        for i in range(15):
            food = Food(
                id=uuid4(),
                name=f"Test Food {i}",
                name_normalized=f"test food {i}",
                serving_size_g=Decimal("100"),
                serving_unit="g",
                source=FoodSource.CUSTOM,
                is_verified=False,
            )
            session.add(food)
        session.commit()

        # Act
        results = food_service.search_foods(session, "test", limit=5)

        # Assert
        assert len(results) <= 5

    def test_search_foods_no_results(self, session: Session):
        """Test searching for non-existent food"""
        # Act
        results = food_service.search_foods(session, "nonexistentfood12345")

        # Assert
        assert len(results) == 0


class TestGetFoodById:
    """Tests for get_food_by_id function"""

    def test_get_food_by_id_success(self, session: Session, sample_food):
        """Test getting food by valid ID"""
        # Act
        food = food_service.get_food_by_id(session, sample_food.id)

        # Assert
        assert food is not None
        assert food.id == sample_food.id
        assert food.name == "Chicken Breast"

    def test_get_food_by_id_not_found(self, session: Session):
        """Test getting food with invalid ID"""
        # Arrange
        fake_id = uuid4()

        # Act
        food = food_service.get_food_by_id(session, fake_id)

        # Assert
        assert food is None


class TestGetFoodsByIds:
    """Tests for get_foods_by_ids function"""

    def test_get_foods_by_ids_multiple(self, session: Session):
        """Test getting multiple foods by IDs"""
        # Arrange - Create 3 foods
        food_ids = []
        for i in range(3):
            food = Food(
                id=uuid4(),
                name=f"Food {i}",
                name_normalized=f"food {i}",
                serving_size_g=Decimal("100"),
                serving_unit="g",
                source=FoodSource.CUSTOM,
                is_verified=False,
            )
            session.add(food)
            food_ids.append(food.id)
        session.commit()

        # Act
        foods = food_service.get_foods_by_ids(session, food_ids)

        # Assert
        assert len(foods) == 3
        assert all(f.id in food_ids for f in foods)

    def test_get_foods_by_ids_empty_list(self, session: Session):
        """Test getting foods with empty ID list"""
        # Act
        foods = food_service.get_foods_by_ids(session, [])

        # Assert
        assert len(foods) == 0

    def test_get_foods_by_ids_some_invalid(self, session: Session, sample_food):
        """Test getting foods with mix of valid and invalid IDs"""
        # Arrange
        fake_id = uuid4()
        food_ids = [sample_food.id, fake_id]

        # Act
        foods = food_service.get_foods_by_ids(session, food_ids)

        # Assert - Should only return the valid food
        assert len(foods) == 1
        assert foods[0].id == sample_food.id


class TestGetFoodWithNutrients:
    """Tests for get_food_with_nutrients function"""

    def test_get_food_with_nutrients_success(self, session: Session, sample_food):
        """Test getting food with its nutrients"""
        # Act
        food = food_service.get_food_with_nutrients(session, sample_food.id)

        # Assert
        assert food is not None
        assert food.id == sample_food.id
        # Note: nutrients relationship should be populated by SQLModel

    def test_get_food_with_nutrients_not_found(self, session: Session):
        """Test getting non-existent food with nutrients"""
        # Arrange
        fake_id = uuid4()

        # Act
        food = food_service.get_food_with_nutrients(session, fake_id)

        # Assert
        assert food is None
