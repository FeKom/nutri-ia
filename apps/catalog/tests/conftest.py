"""
PyTest configuration and fixtures for tests

To run tests:
1. Install test dependencies: pip install pytest pytest-asyncio httpx
2. Run: pytest tests/
"""
import pytest
from datetime import datetime, date
from decimal import Decimal
from uuid import uuid4
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool

from app.models.food import Food, FoodNutrient
from app.models.tracking import MealLog, DailyStats, MealType
from app.models.user import UserProfile, ActivityLevel, DietGoal


@pytest.fixture(name="engine")
def engine_fixture():
    """Create an in-memory SQLite database for testing"""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    return engine


@pytest.fixture(name="session")
def session_fixture(engine):
    """Create a database session for testing"""
    with Session(engine) as session:
        yield session


@pytest.fixture(name="sample_food")
def sample_food_fixture(session: Session):
    """Create a sample food item for testing"""
    food = Food(
        id=uuid4(),
        name="Chicken Breast",
        name_normalized="chicken breast",
        category="meat",
        serving_size_g=Decimal("100"),
        serving_unit="g",
        calorie_per_100g=Decimal("165"),
        source="USDA",
        is_verified=True,
    )
    session.add(food)

    nutrients = FoodNutrient(
        id=uuid4(),
        food_id=food.id,
        calories_100g=Decimal("165"),
        protein_g_100g=Decimal("31"),
        carbs_g_100g=Decimal("0"),
        fat_g_100g=Decimal("3.6"),
        fiber_g_100g=Decimal("0"),
        sodium_mg_100g=Decimal("74"),
    )
    session.add(nutrients)
    session.commit()
    session.refresh(food)

    return food


@pytest.fixture(name="sample_user")
def sample_user_fixture(session: Session):
    """Create a sample user profile for testing"""
    user = UserProfile(
        id=uuid4(),
        user_id=uuid4(),
        name="Test User",
        age=30,
        weight_kg=75.0,
        height_cm=175.0,
        gender="male",
        activity_level=ActivityLevel.MODERATE,
        diet_goal=DietGoal.MAINTAIN,
    )
    session.add(user)
    session.commit()
    session.refresh(user)

    return user
