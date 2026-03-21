"""
Script to import USDA FoodData Central data from CSV files.

Download the CSV files from: https://fdc.nal.usda.gov/download-datasets.html
Choose "Full Download of All Data Types" or "SR Legacy" for basic foods.

Expected files in data/usda/:
- food.csv
- food_nutrient.csv

Run: python -m scripts.import_usda
"""
import csv
import sys
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Optional

from sqlmodel import Session

from app.database.database import engine
from app.models.food import Food, FoodNutrient, FoodSource

# Configuration
DATA_DIR = Path("/data/usda")
BATCH_SIZE = 1000

# USDA nutrient IDs -> FoodNutrient fields mapping
NUTRIENT_MAP = {
    1008: "calories_100g",        # Energy (kcal)
    1003: "protein_g_100g",       # Protein
    1005: "carbs_g_100g",         # Carbohydrate, by difference
    1004: "fat_g_100g",           # Total lipid (fat)
    1258: "saturated_fat_g_100g", # Fatty acids, total saturated
    1079: "fiber_g_100g",         # Fiber, total dietary
    2000: "sugar_g_100g",         # Sugars, total
    1093: "sodium_mg_100g",       # Sodium, Na
    1087: "calcium_mg_100g",      # Calcium, Ca
    1089: "iron_mg_100g",         # Iron, Fe
    1162: "vitamin_c_mg_100g",    # Vitamin C, total ascorbic acid
}


def parse_decimal(value: str) -> Optional[Decimal]:
    """Safely parse a decimal value from string."""
    if not value or value.strip() == "":
        return None
    try:
        return Decimal(value.strip()).quantize(Decimal("0.01"))
    except InvalidOperation:
        return None


def normalize_name(name: str) -> str:
    """Normalize food name for searching."""
    return name.lower().strip().replace(",", "").replace("  ", " ")


def load_foods(filepath: Path) -> dict:
    """
    Load foods from USDA food.csv file.

    Returns dict: {fdc_id: {food fields for Food model}}
    """
    foods = {}

    with open(filepath, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            fdc_id = row.get("fdc_id")
            if not fdc_id:
                continue

            description = row.get("description", "").strip()
            if not description:
                continue

            # Filter by data_type (SR Legacy, Foundation, or Survey foods)
            data_type = row.get("data_type", "")
            if data_type not in ["sr_legacy_food", "foundation_food", "survey_fndds_food"]:
                continue

            # Map to Food model fields
            foods[fdc_id] = {
                "name": description[:255],
                "name_normalized": normalize_name(description)[:255],
                "category": row.get("food_category_id")[:50] if row.get("food_category_id") else None,
                "serving_size_g": Decimal("100"),
                "serving_unit": "g",
                "usda_id": fdc_id,
                "source": FoodSource.USDA,
                "is_verified": True,
            }

    return foods


def load_nutrients(filepath: Path, food_ids: set) -> dict:
    """
    Load nutrients from USDA food_nutrient.csv file.

    Returns dict: {fdc_id: {FoodNutrient fields}}
    """
    nutrients = {}

    with open(filepath, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            fdc_id = row.get("fdc_id")

            # Skip if food not in our list
            if fdc_id not in food_ids:
                continue

            try:
                nutrient_id = int(row.get("nutrient_id", 0))
            except ValueError:
                continue

            # Check if this nutrient maps to a FoodNutrient field
            field_name = NUTRIENT_MAP.get(nutrient_id)
            if not field_name:
                continue

            amount = parse_decimal(row.get("amount", ""))
            if amount is None:
                continue

            if fdc_id not in nutrients:
                nutrients[fdc_id] = {}

            nutrients[fdc_id][field_name] = amount

    return nutrients


def import_usda_data():
    """Import USDA data into foods and food_nutrients tables."""
    print("=== USDA Data Import ===\n")

    # Verify data directory
    if not DATA_DIR.exists():
        print(f"Error: Data directory not found: {DATA_DIR}")
        print("\nInstructions:")
        print("1. Download from https://fdc.nal.usda.gov/download-datasets.html")
        print("2. Extract CSV files to data/usda/")
        print("   - food.csv")
        print("   - food_nutrient.csv")
        sys.exit(1)

    food_file = DATA_DIR / "food.csv"
    nutrient_file = DATA_DIR / "food_nutrient.csv"

    for f in [food_file, nutrient_file]:
        if not f.exists():
            print(f"Error: File not found: {f}")
            sys.exit(1)

    # Step 1: Load foods
    print("Loading foods from CSV...")
    foods_data = load_foods(food_file)
    print(f"  Found {len(foods_data)} foods")

    # Step 2: Load nutrients (only for foods we have)
    print("Loading nutrients from CSV...")
    nutrients_data = load_nutrients(nutrient_file, set(foods_data.keys()))
    print(f"  Found nutrients for {len(nutrients_data)} foods")

    # Step 3: Import to database
    print(f"\nImporting to database (batch size: {BATCH_SIZE})...")

    imported = 0
    skipped = 0
    batch_foods = []
    batch_fdc_ids = []

    with Session(engine) as session:
        for fdc_id, food_data in foods_data.items():
            # Skip foods without nutrients
            if fdc_id not in nutrients_data:
                skipped += 1
                continue

            # Set calorie_per_100g from nutrients
            food_data["calorie_per_100g"] = nutrients_data[fdc_id].get("calories_100g")

            batch_foods.append(Food(**food_data))
            batch_fdc_ids.append(fdc_id)

            # Process batch
            if len(batch_foods) >= BATCH_SIZE:
                session.add_all(batch_foods)
                session.flush()

                # Create FoodNutrient for each food
                batch_nutrients = []
                for i, food in enumerate(batch_foods):
                    fdc = batch_fdc_ids[i]
                    batch_nutrients.append(FoodNutrient(
                        food_id=food.id,
                        **nutrients_data[fdc]
                    ))

                session.add_all(batch_nutrients)
                session.commit()

                imported += len(batch_foods)
                print(f"  Imported {imported} foods...")

                batch_foods = []
                batch_fdc_ids = []

        # Process remaining
        if batch_foods:
            session.add_all(batch_foods)
            session.flush()

            batch_nutrients = []
            for i, food in enumerate(batch_foods):
                fdc = batch_fdc_ids[i]
                batch_nutrients.append(FoodNutrient(
                    food_id=food.id,
                    **nutrients_data[fdc]
                ))

            session.add_all(batch_nutrients)
            session.commit()
            imported += len(batch_foods)

    print(f"\n=== Import Complete ===")
    print(f"Imported: {imported} foods + nutrients")
    print(f"Skipped (no nutrients): {skipped}")


if __name__ == "__main__":
    try:
        import_usda_data()
    except KeyboardInterrupt:
        print("\nCancelled.")
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}")
        raise
