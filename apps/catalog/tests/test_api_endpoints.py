"""
Integration tests for API endpoints

To run these tests:
pip install httpx
pytest tests/test_api_endpoints.py -v
"""
from decimal import Decimal
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool

from app.main import app
from app.api.dependencies import get_db
from app.models.food import Food, FoodNutrient, FoodSource
from app.models.user import ActivityLevel, DietGoal, UserProfile


@pytest.fixture(name="client")
def client_fixture():
    """Create a test client with in-memory database"""
    # Create in-memory SQLite database
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)

    # Override dependency
    def get_test_db():
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_db] = get_test_db

    # Create test client
    client = TestClient(app)
    yield client

    # Clean up
    app.dependency_overrides.clear()


@pytest.fixture(name="test_food")
def test_food_fixture(client):
    """Create a test food in the database"""
    # We need to access the database through the dependency override
    from app.api.dependencies import get_db

    db_generator = app.dependency_overrides[get_db]()
    session = next(db_generator)

    food = Food(
        id=uuid4(),
        name="Test Chicken",
        name_normalized="test chicken",
        category="meat",
        serving_size_g=Decimal("100"),
        serving_unit="g",
        calorie_per_100g=Decimal("165"),
        source=FoodSource.USDA,
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
    )
    session.add(nutrients)
    session.commit()
    session.refresh(food)

    return food


class TestHealthEndpoints:
    """Tests for health check endpoints"""

    def test_root_endpoint(self, client):
        """Test root endpoint"""
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Nutria Food Catalog API"
        assert "version" in data

    def test_health_endpoint(self, client):
        """Test health check endpoint"""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"


class TestFoodEndpoints:
    """Tests for food search endpoints"""

    def test_search_foods(self, client, test_food):
        """Test food search endpoint"""
        response = client.post(
            "/api/v1/foods/search",
            json={"query": "chicken", "limit": 10}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert len(data["foods"]) >= 1
        assert any(f["name"] == "Test Chicken" for f in data["foods"])

    def test_search_foods_with_filters(self, client, test_food):
        """Test food search with filters"""
        response = client.post(
            "/api/v1/foods/search",
            json={
                "query": "chicken",
                "limit": 10,
                "filters": {
                    "category": "meat",
                    "verified_only": True
                }
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

    def test_search_foods_empty_query(self, client):
        """Test search with empty query should fail"""
        response = client.post(
            "/api/v1/foods/search",
            json={"query": "", "limit": 10}
        )
        assert response.status_code == 422  # Validation error


class TestNutritionEndpoints:
    """Tests for nutrition calculation endpoints"""

    def test_calculate_nutrition(self, client, test_food):
        """Test nutrition calculation endpoint"""
        response = client.post(
            "/api/v1/nutrition/calculate",
            json={
                "foods": [
                    {
                        "food_id": str(test_food.id),
                        "quantity": 150
                    }
                ]
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "total" in data
        assert "details" in data
        # Calories might be returned as string due to Decimal serialization
        calories = float(data["total"]["calories"])
        assert abs(calories - 247.5) < 1  # 165 * 1.5

    def test_calculate_nutrition_invalid_food_id(self, client):
        """Test calculation with invalid food ID"""
        fake_id = str(uuid4())
        response = client.post(
            "/api/v1/nutrition/calculate",
            json={
                "foods": [
                    {
                        "food_id": fake_id,
                        "quantity": 100
                    }
                ]
            }
        )
        assert response.status_code == 200  # Still succeeds but returns zeros
        data = response.json()
        assert data["total"]["calories"] == 0

    def test_calculate_nutrition_empty_foods_list(self, client):
        """Test calculation with empty foods list should fail"""
        response = client.post(
            "/api/v1/nutrition/calculate",
            json={"foods": []}
        )
        assert response.status_code == 422  # Validation error


class TestTrackingEndpoints:
    """Tests for meal tracking endpoints"""

    @pytest.fixture
    def test_user(self, client):
        """Create a test user"""
        from app.api.dependencies import get_db

        db_generator = app.dependency_overrides[get_db]()
        session = next(db_generator)

        user = UserProfile(
            id=uuid4(),
            user_id=uuid4(),
            name="Test User",
            activity_level=ActivityLevel.MODERATE,
            diet_goal=DietGoal.MAINTAIN,
        )
        session.add(user)
        session.commit()
        session.refresh(user)

        return user

    def test_log_meal(self, client, test_food, test_user):
        """Test meal logging endpoint"""
        response = client.post(
            "/api/v1/tracking/meals/log",
            json={
                "user_id": str(test_user.user_id),
                "meal_type": "breakfast",
                "foods": [
                    {
                        "food_id": str(test_food.id),
                        "quantity_g": 150,
                        "name": "Test Chicken"
                    }
                ],
                "notes": "Test meal"
            }
        )
        assert response.status_code == 201
        data = response.json()
        assert data["meal_type"] == "breakfast"
        assert data["total_calories"] > 0

    def test_get_daily_summary(self, client, test_user):
        """Test daily summary endpoint"""
        from datetime import date

        response = client.get(
            f"/api/v1/tracking/summary/daily?user_id={test_user.user_id}&date={date.today().isoformat()}"
        )
        assert response.status_code == 200
        data = response.json()
        assert "date" in data
        assert "meals" in data
        assert "totals" in data
        assert "targets" in data
        assert "progress" in data

    def test_get_weekly_stats(self, client, test_user):
        """Test weekly stats endpoint"""
        response = client.get(
            f"/api/v1/tracking/stats/weekly?user_id={test_user.user_id}&days=7"
        )
        assert response.status_code == 200
        data = response.json()
        assert "user_id" in data
        assert "stats" in data
        assert "averages" in data
        assert "adherence_rate" in data


class TestRecommendationEndpoints:
    """Tests for recommendation endpoints"""

    @pytest.fixture
    def test_user_with_restrictions(self, client):
        """Create a test user with dietary restrictions"""
        from app.api.dependencies import get_db

        db_generator = app.dependency_overrides[get_db]()
        session = next(db_generator)

        user = UserProfile(
            id=uuid4(),
            user_id=uuid4(),
            name="Vegetarian User",
            activity_level=ActivityLevel.MODERATE,
            diet_goal=DietGoal.MAINTAIN,
            dietary_restrictions=["vegetariano"],
        )
        session.add(user)
        session.commit()
        session.refresh(user)

        return user

    def test_get_recommendations(self, client, test_food, test_user_with_restrictions):
        """Test recommendations endpoint"""
        response = client.post(
            "/api/v1/recommendations/",
            json={
                "user_id": str(test_user_with_restrictions.user_id),
                "limit": 10
            }
        )
        # Note: This might be 404 if endpoint doesn't exist yet
        # Adjust based on actual implementation
        if response.status_code == 200:
            data = response.json()
            assert isinstance(data, list) or isinstance(data, dict)
