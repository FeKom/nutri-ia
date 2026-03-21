"""
Script to seed the database with sample food data
Run: python seed_data.py
"""
import sys
from datetime import datetime
from decimal import Decimal
from uuid import uuid4

from sqlmodel import Session, select

from app.database.database import engine
from app.models.food import Food, FoodNutrient, FoodSource


def seed_sample_data():
    """Add sample food data to the database"""

    with Session(engine) as session:
        # Check if data already exists
        statement = select(Food)
        existing_foods = session.exec(statement).first()

        if existing_foods:
            print("Database already contains data. Skipping seed.")
            return

        print("Seeding database with sample food data...")

        # Sample Foods
        foods_data = [
            {
                "name": "Chicken Breast, Skinless",
                "name_normalized": "chicken breast skinless",
                "category": "protein",
                "serving_size_g": Decimal("100"),
                "serving_unit": "g",
                "calorie_per_100g": Decimal("165"),
                "source": FoodSource.USDA,
                "is_verified": True,
                "nutrients": {
                    "calories_100g": Decimal("165"),
                    "protein_g_100g": Decimal("31"),
                    "carbs_g_100g": Decimal("0"),
                    "fat_g_100g": Decimal("3.6"),
                    "saturated_fat_g_100g": Decimal("1.0"),
                    "fiber_g_100g": Decimal("0"),
                    "sugar_g_100g": Decimal("0"),
                    "sodium_mg_100g": Decimal("74"),
                    "calcium_mg_100g": Decimal("15"),
                    "iron_mg_100g": Decimal("1.04"),
                    "vitamin_c_mg_100g": Decimal("0"),
                },
            },
            {
                "name": "Brown Rice, Cooked",
                "name_normalized": "brown rice cooked",
                "category": "grains",
                "serving_size_g": Decimal("100"),
                "serving_unit": "g",
                "calorie_per_100g": Decimal("112"),
                "source": FoodSource.USDA,
                "is_verified": True,
                "nutrients": {
                    "calories_100g": Decimal("112"),
                    "protein_g_100g": Decimal("2.6"),
                    "carbs_g_100g": Decimal("23.5"),
                    "fat_g_100g": Decimal("0.9"),
                    "saturated_fat_g_100g": Decimal("0.2"),
                    "fiber_g_100g": Decimal("1.8"),
                    "sugar_g_100g": Decimal("0.4"),
                    "sodium_mg_100g": Decimal("5"),
                    "calcium_mg_100g": Decimal("10"),
                    "iron_mg_100g": Decimal("0.56"),
                    "vitamin_c_mg_100g": Decimal("0"),
                },
            },
            {
                "name": "Broccoli, Raw",
                "name_normalized": "broccoli raw",
                "category": "vegetables",
                "serving_size_g": Decimal("100"),
                "serving_unit": "g",
                "calorie_per_100g": Decimal("34"),
                "source": FoodSource.USDA,
                "is_verified": True,
                "nutrients": {
                    "calories_100g": Decimal("34"),
                    "protein_g_100g": Decimal("2.8"),
                    "carbs_g_100g": Decimal("6.6"),
                    "fat_g_100g": Decimal("0.4"),
                    "saturated_fat_g_100g": Decimal("0.1"),
                    "fiber_g_100g": Decimal("2.6"),
                    "sugar_g_100g": Decimal("1.7"),
                    "sodium_mg_100g": Decimal("33"),
                    "calcium_mg_100g": Decimal("47"),
                    "iron_mg_100g": Decimal("0.73"),
                    "vitamin_c_mg_100g": Decimal("89.2"),
                },
            },
            {
                "name": "Sweet Potato, Baked",
                "name_normalized": "sweet potato baked",
                "category": "vegetables",
                "serving_size_g": Decimal("100"),
                "serving_unit": "g",
                "calorie_per_100g": Decimal("90"),
                "source": FoodSource.USDA,
                "is_verified": True,
                "nutrients": {
                    "calories_100g": Decimal("90"),
                    "protein_g_100g": Decimal("2.0"),
                    "carbs_g_100g": Decimal("20.7"),
                    "fat_g_100g": Decimal("0.2"),
                    "saturated_fat_g_100g": Decimal("0.0"),
                    "fiber_g_100g": Decimal("3.3"),
                    "sugar_g_100g": Decimal("6.5"),
                    "sodium_mg_100g": Decimal("36"),
                    "calcium_mg_100g": Decimal("38"),
                    "iron_mg_100g": Decimal("0.69"),
                    "vitamin_c_mg_100g": Decimal("19.6"),
                }
            },
            {
                "name": "Salmon, Atlantic, Raw",
                "name_normalized": "salmon atlantic raw",
                "category": "protein",
                "serving_size_g": Decimal("100"),
                "serving_unit": "g",
                "calorie_per_100g": Decimal("208"),
                "source": FoodSource.USDA,
                "is_verified": True,
                "nutrients": {
                    "calories_100g": Decimal("208"),
                    "protein_g_100g": Decimal("20.4"),
                    "carbs_g_100g": Decimal("0"),
                    "fat_g_100g": Decimal("13.4"),
                    "saturated_fat_g_100g": Decimal("3.1"),
                    "fiber_g_100g": Decimal("0"),
                    "sugar_g_100g": Decimal("0"),
                    "sodium_mg_100g": Decimal("59"),
                    "calcium_mg_100g": Decimal("12"),
                    "iron_mg_100g": Decimal("0.8"),
                    "vitamin_c_mg_100g": Decimal("0"),
                }
            },
        ]

        # Create foods and nutrients
        for food_data in foods_data:
            nutrients_data = food_data.pop("nutrients")

            # Create food
            food = Food(**food_data)
            session.add(food)
            session.flush()  # Flush to get the food.id

            # Create nutrients
            nutrient = FoodNutrient(food_id=food.id, **nutrients_data)
            session.add(nutrient)

        session.commit()
        print(f"Successfully seeded {len(foods_data)} food items!")


if __name__ == "__main__":
    try:
        seed_sample_data()
    except Exception as e:
        print(f"Error seeding data: {e}")
        sys.exit(1)
