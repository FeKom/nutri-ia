"""
Tests for nutrition service

To run these tests:
pytest tests/test_nutrition_service.py -v
"""
from decimal import Decimal
from uuid import uuid4

import pytest
from sqlmodel import Session

from app.models.food import Food, FoodNutrient
from app.schemas.food import FoodQuantity
from app.services import nutrition_service


class TestCalculateNutrition:
    """Tests for calculate_nutrition function"""

    def test_calculate_nutrition_single_food(self, session: Session, sample_food):
        """Test calculating nutrition for a single food item"""
        # Arrange
        food_quantities = [
            FoodQuantity(food_id=sample_food.id, quantity=Decimal("100"))
        ]

        # Act
        totals, details = nutrition_service.calculate_nutrition(session, food_quantities)

        # Assert
        assert totals.calories == Decimal("165")
        assert totals.protein_g == Decimal("31")
        assert totals.carbs_g == Decimal("0")
        assert totals.fat_g == Decimal("3.6")
        assert len(details) == 1
        assert details[0].food_name == "Chicken Breast"

    def test_calculate_nutrition_multiple_foods(self, session: Session):
        """Test calculating nutrition for multiple food items"""
        # Arrange - Create two foods
        food1 = Food(
            id=uuid4(),
            name="Rice",
            name_normalized="rice",
            category="grains",
            serving_size_g=Decimal("100"),
            serving_unit="g",
            source="USDA",
            is_verified=True,
        )
        session.add(food1)

        nutrients1 = FoodNutrient(
            id=uuid4(),
            food_id=food1.id,
            calories_100g=Decimal("130"),
            protein_g_100g=Decimal("2.7"),
            carbs_g_100g=Decimal("28"),
            fat_g_100g=Decimal("0.3"),
        )
        session.add(nutrients1)

        food2 = Food(
            id=uuid4(),
            name="Beans",
            name_normalized="beans",
            category="legumes",
            serving_size_g=Decimal("100"),
            serving_unit="g",
            source="USDA",
            is_verified=True,
        )
        session.add(food2)

        nutrients2 = FoodNutrient(
            id=uuid4(),
            food_id=food2.id,
            calories_100g=Decimal("127"),
            protein_g_100g=Decimal("8.7"),
            carbs_g_100g=Decimal("23"),
            fat_g_100g=Decimal("0.5"),
        )
        session.add(nutrients2)
        session.commit()

        food_quantities = [
            FoodQuantity(food_id=food1.id, quantity=Decimal("150")),
            FoodQuantity(food_id=food2.id, quantity=Decimal("100")),
        ]

        # Act
        totals, details = nutrition_service.calculate_nutrition(session, food_quantities)

        # Assert
        # 150g rice: 130 * 1.5 = 195 cal, 2.7 * 1.5 = 4.05 protein
        # 100g beans: 127 cal, 8.7 protein
        # Total: 322 cal, 12.75 protein
        assert abs(totals.calories - Decimal("322")) < 1
        assert abs(totals.protein_g - Decimal("12.75")) < 0.5
        assert len(details) == 2

    def test_calculate_nutrition_with_scaling(self, session: Session, sample_food):
        """Test that nutrition scales correctly with quantity"""
        # Arrange
        food_quantities = [
            FoodQuantity(food_id=sample_food.id, quantity=Decimal("200"))
        ]

        # Act
        totals, details = nutrition_service.calculate_nutrition(session, food_quantities)

        # Assert - Should be double the 100g values
        assert totals.calories == Decimal("330")  # 165 * 2
        assert totals.protein_g == Decimal("62")  # 31 * 2

    def test_calculate_nutrition_food_not_found(self, session: Session):
        """Test calculating nutrition for non-existent food"""
        # Arrange
        fake_id = uuid4()
        food_quantities = [
            FoodQuantity(food_id=fake_id, quantity=Decimal("100"))
        ]

        # Act
        totals, details = nutrition_service.calculate_nutrition(session, food_quantities)

        # Assert - Should return zeros
        assert totals.calories == 0
        assert totals.protein_g == 0
        assert len(details) == 0

    def test_calculate_nutrition_includes_micronutrients(self, session: Session, sample_food):
        """Test that micronutrients are calculated correctly"""
        # Arrange
        food_quantities = [
            FoodQuantity(food_id=sample_food.id, quantity=Decimal("100"))
        ]

        # Act
        totals, details = nutrition_service.calculate_nutrition(session, food_quantities)

        # Assert
        assert totals.sodium_mg == Decimal("74")
        assert totals.fiber_g == Decimal("0")


class TestGetNutrientByFoodId:
    """Tests for get_nutrient_by_food_id function"""

    def test_get_nutrient_by_food_id_success(self, session: Session, sample_food):
        """Test getting nutrients for an existing food"""
        # Act
        nutrient = nutrition_service.get_nutrient_by_food_id(session, sample_food.id)

        # Assert
        assert nutrient is not None
        assert nutrient.food_id == sample_food.id
        assert nutrient.protein_g_100g == Decimal("31")

    def test_get_nutrient_by_food_id_not_found(self, session: Session):
        """Test getting nutrients for non-existent food"""
        # Arrange
        fake_id = uuid4()

        # Act
        nutrient = nutrition_service.get_nutrient_by_food_id(session, fake_id)

        # Assert
        assert nutrient is None
