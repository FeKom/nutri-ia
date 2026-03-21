"""
Tests for recommendation service

To run these tests:
pytest tests/test_recommendation_service.py -v
"""
from decimal import Decimal
from uuid import uuid4

import pytest
from sqlmodel import Session

from app.models.food import Food, FoodSource
from app.models.user import ActivityLevel, DietGoal, UserProfile
from app.services import recomendation_service


@pytest.fixture
def sample_foods(session: Session):
    """Create sample foods with different categories"""
    foods = [
        Food(
            id=uuid4(),
            name="Chicken Breast",
            name_normalized="chicken breast",
            category="meat",
            serving_size_g=Decimal("100"),
            serving_unit="g",
            source=FoodSource.USDA,
            is_verified=True,
        ),
        Food(
            id=uuid4(),
            name="Broccoli",
            name_normalized="broccoli",
            category="vegetables",
            serving_size_g=Decimal("100"),
            serving_unit="g",
            source=FoodSource.USDA,
            is_verified=True,
        ),
        Food(
            id=uuid4(),
            name="Milk",
            name_normalized="milk",
            category="dairy",
            serving_size_g=Decimal("100"),
            serving_unit="ml",
            source=FoodSource.USDA,
            is_verified=True,
        ),
        Food(
            id=uuid4(),
            name="Wheat Bread",
            name_normalized="wheat bread",
            category="grains",
            serving_size_g=Decimal("100"),
            serving_unit="g",
            source=FoodSource.USDA,
            is_verified=True,
        ),
        Food(
            id=uuid4(),
            name="Peanuts",
            name_normalized="peanuts",
            category="nuts",
            serving_size_g=Decimal("100"),
            serving_unit="g",
            source=FoodSource.USDA,
            is_verified=True,
        ),
    ]

    for food in foods:
        session.add(food)
    session.commit()

    return foods


class TestRecommendFoods:
    """Tests for recommend_foods function"""

    def test_recommend_foods_no_restrictions(self, session: Session, sample_foods):
        """Test recommendations with no dietary restrictions"""
        # Arrange
        profile = UserProfile(
            id=uuid4(),
            user_id=uuid4(),
            name="Test User",
            activity_level=ActivityLevel.MODERATE,
            diet_goal=DietGoal.MAINTAIN,
        )
        session.add(profile)
        session.commit()

        # Act
        recommendations = recomendation_service.recommend_foods(session, profile, limit=50)

        # Assert
        assert len(recommendations) == len(sample_foods)

    def test_recommend_foods_vegetarian_restriction(self, session: Session, sample_foods):
        """Test vegetarian restrictions exclude meat"""
        # Arrange
        profile = UserProfile(
            id=uuid4(),
            user_id=uuid4(),
            name="Vegetarian User",
            activity_level=ActivityLevel.MODERATE,
            diet_goal=DietGoal.MAINTAIN,
            dietary_restrictions=["vegetariano"],
        )
        session.add(profile)
        session.commit()

        # Act
        recommendations = recomendation_service.recommend_foods(session, profile, limit=50)

        # Assert - Should exclude chicken
        assert not any(f.name == "Chicken Breast" for f in recommendations)
        assert any(f.name == "Broccoli" for f in recommendations)
        assert any(f.name == "Milk" for f in recommendations)

    def test_recommend_foods_vegan_restriction(self, session: Session, sample_foods):
        """Test vegan restrictions exclude meat and dairy"""
        # Arrange
        profile = UserProfile(
            id=uuid4(),
            user_id=uuid4(),
            name="Vegan User",
            activity_level=ActivityLevel.MODERATE,
            diet_goal=DietGoal.MAINTAIN,
            dietary_restrictions=["vegano"],
        )
        session.add(profile)
        session.commit()

        # Act
        recommendations = recomendation_service.recommend_foods(session, profile, limit=50)

        # Assert - Should exclude chicken and milk
        assert not any(f.name == "Chicken Breast" for f in recommendations)
        assert not any(f.name == "Milk" for f in recommendations)
        assert any(f.name == "Broccoli" for f in recommendations)

    def test_recommend_foods_gluten_free_restriction(self, session: Session, sample_foods):
        """Test gluten-free restrictions exclude wheat products"""
        # Arrange
        profile = UserProfile(
            id=uuid4(),
            user_id=uuid4(),
            name="Gluten-Free User",
            activity_level=ActivityLevel.MODERATE,
            diet_goal=DietGoal.MAINTAIN,
            dietary_restrictions=["sem_gluten"],
        )
        session.add(profile)
        session.commit()

        # Act
        recommendations = recomendation_service.recommend_foods(session, profile, limit=50)

        # Assert - Should exclude wheat bread
        assert not any(f.name == "Wheat Bread" for f in recommendations)
        assert any(f.name == "Chicken Breast" for f in recommendations)

    def test_recommend_foods_with_allergies(self, session: Session, sample_foods):
        """Test that allergies exclude foods containing allergens"""
        # Arrange
        profile = UserProfile(
            id=uuid4(),
            user_id=uuid4(),
            name="Allergy User",
            activity_level=ActivityLevel.MODERATE,
            diet_goal=DietGoal.MAINTAIN,
            allergies=["amendoim"],
        )
        session.add(profile)
        session.commit()

        # Act
        recommendations = recomendation_service.recommend_foods(session, profile, limit=50)

        # Assert - Should exclude peanuts
        assert not any(f.name == "Peanuts" for f in recommendations)
        assert any(f.name == "Broccoli" for f in recommendations)

    def test_recommend_foods_with_disliked_foods(self, session: Session, sample_foods):
        """Test that disliked foods are excluded"""
        # Arrange
        profile = UserProfile(
            id=uuid4(),
            user_id=uuid4(),
            name="Picky User",
            activity_level=ActivityLevel.MODERATE,
            diet_goal=DietGoal.MAINTAIN,
            disliked_foods=["broccoli"],
        )
        session.add(profile)
        session.commit()

        # Act
        recommendations = recomendation_service.recommend_foods(session, profile, limit=50)

        # Assert - Should exclude broccoli
        assert not any(f.name == "Broccoli" for f in recommendations)
        assert any(f.name == "Chicken Breast" for f in recommendations)

    def test_recommend_foods_multiple_restrictions(self, session: Session, sample_foods):
        """Test multiple restrictions working together"""
        # Arrange
        profile = UserProfile(
            id=uuid4(),
            user_id=uuid4(),
            name="Restricted User",
            activity_level=ActivityLevel.MODERATE,
            diet_goal=DietGoal.MAINTAIN,
            dietary_restrictions=["vegetariano"],
            allergies=["amendoim"],
            disliked_foods=["milk"],
        )
        session.add(profile)
        session.commit()

        # Act
        recommendations = recomendation_service.recommend_foods(session, profile, limit=50)

        # Assert
        assert not any(f.name == "Chicken Breast" for f in recommendations)  # vegetarian
        assert not any(f.name == "Peanuts" for f in recommendations)  # allergy
        assert not any(f.name == "Milk" for f in recommendations)  # disliked
        assert any(f.name == "Broccoli" for f in recommendations)  # should be ok

    def test_recommend_foods_respects_limit(self, session: Session, sample_foods):
        """Test that limit parameter is respected"""
        # Arrange
        profile = UserProfile(
            id=uuid4(),
            user_id=uuid4(),
            name="Test User",
            activity_level=ActivityLevel.MODERATE,
            diet_goal=DietGoal.MAINTAIN,
        )
        session.add(profile)
        session.commit()

        # Act
        recommendations = recomendation_service.recommend_foods(session, profile, limit=2)

        # Assert
        assert len(recommendations) <= 2


class TestGetFoodsByCategory:
    """Tests for get_foods_by_category function"""

    def test_get_foods_by_category_success(self, session: Session, sample_foods):
        """Test getting foods by category"""
        # Arrange
        profile = UserProfile(
            id=uuid4(),
            user_id=uuid4(),
            name="Test User",
            activity_level=ActivityLevel.MODERATE,
            diet_goal=DietGoal.MAINTAIN,
        )
        session.add(profile)
        session.commit()

        # Act
        vegetables = recomendation_service.get_foods_by_category(
            session, profile, "vegetables", limit=20
        )

        # Assert
        assert len(vegetables) >= 1
        assert all(f.category == "vegetables" for f in vegetables)
        assert any(f.name == "Broccoli" for f in vegetables)

    def test_get_foods_by_category_with_restrictions(self, session: Session, sample_foods):
        """Test category filtering respects dietary restrictions"""
        # Arrange
        profile = UserProfile(
            id=uuid4(),
            user_id=uuid4(),
            name="Vegetarian User",
            activity_level=ActivityLevel.MODERATE,
            diet_goal=DietGoal.MAINTAIN,
            dietary_restrictions=["vegetariano"],
        )
        session.add(profile)
        session.commit()

        # Act
        meat = recomendation_service.get_foods_by_category(
            session, profile, "meat", limit=20
        )

        # Assert - Should be empty because user is vegetarian
        assert len(meat) == 0

    def test_get_foods_by_category_case_insensitive(self, session: Session, sample_foods):
        """Test that category search is case-insensitive"""
        # Arrange
        profile = UserProfile(
            id=uuid4(),
            user_id=uuid4(),
            name="Test User",
            activity_level=ActivityLevel.MODERATE,
            diet_goal=DietGoal.MAINTAIN,
        )
        session.add(profile)
        session.commit()

        # Act
        vegetables_lower = recomendation_service.get_foods_by_category(
            session, profile, "vegetables", limit=20
        )
        vegetables_upper = recomendation_service.get_foods_by_category(
            session, profile, "VEGETABLES", limit=20
        )

        # Assert
        assert len(vegetables_lower) == len(vegetables_upper)
