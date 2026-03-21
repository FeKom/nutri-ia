"""
Script to process USDA Foundation Foods CSV data and prepare it for database import.

This script:
1. Reads the Foundation Foods CSV files
2. Filters only foundation_food data type
3. Aggregates nutrients per food (averaging sub_sample values)
4. Generates clean CSVs ready for database import

Run: python -m scripts.process_foundation_foods
"""
import csv
import uuid
from collections import defaultdict
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Optional

import pandas as pd

# Configuration
CSV_DIR = Path(__file__).parent.parent / "data/usda/FoodData_Central_foundation_food_csv_2025-12-18"
OUTPUT_DIR = Path(__file__).parent.parent / "data/processed"

# USDA nutrient IDs -> database fields mapping
# Multiple IDs can map to the same field (fallback order)
NUTRIENT_MAP = {
    1008: "calories_100g",        # Energy (kcal)
    2047: "calories_100g",        # Energy (Atwater General Factors) - fallback
    2048: "calories_100g",        # Energy (Atwater Specific Factors) - fallback
    1003: "protein_g_100g",       # Protein
    1005: "carbs_g_100g",         # Carbohydrate, by difference
    1004: "fat_g_100g",           # Total lipid (fat)
    1258: "saturated_fat_g_100g", # Fatty acids, total saturated
    1079: "fiber_g_100g",         # Fiber, total dietary
    1063: "sugar_g_100g",         # Sugars, Total
    1093: "sodium_mg_100g",       # Sodium, Na
    1087: "calcium_mg_100g",      # Calcium, Ca
    1089: "iron_mg_100g",         # Iron, Fe
    1162: "vitamin_c_mg_100g",    # Vitamin C, total ascorbic acid
}


def parse_decimal(value, precision: int = 2) -> Optional[Decimal]:
    """Safely parse a decimal value from string."""
    if pd.isna(value) or value == "" or value is None:
        return None
    try:
        return Decimal(str(value)).quantize(Decimal(f"0.{'0' * precision}"))
    except (InvalidOperation, ValueError):
        return None


def normalize_name(name: str) -> str:
    """Normalize food name for searching - lowercase, remove punctuation, single spaces."""
    if not name:
        return ""
    normalized = name.lower().strip()
    # Remove common punctuation but keep spaces
    for char in [",", ".", ";", ":", "'", '"', "(", ")", "[", "]"]:
        normalized = normalized.replace(char, "")
    # Collapse multiple spaces
    while "  " in normalized:
        normalized = normalized.replace("  ", " ")
    return normalized.strip()


def load_categories(csv_dir: Path) -> dict:
    """Load food categories mapping."""
    categories = {}
    cat_file = csv_dir / "food_category.csv"

    if cat_file.exists():
        df = pd.read_csv(cat_file)
        for _, row in df.iterrows():
            categories[int(row['id'])] = row['description']

    return categories


def load_foundation_food_ids(csv_dir: Path) -> set:
    """Load the set of fdc_ids that are Foundation Foods."""
    foundation_file = csv_dir / "foundation_food.csv"
    foundation_ids = set()

    if foundation_file.exists():
        df = pd.read_csv(foundation_file)
        foundation_ids = set(df['fdc_id'].astype(int))

    return foundation_ids


def process_foods(csv_dir: Path, categories: dict, foundation_ids: set) -> pd.DataFrame:
    """
    Process foods from USDA food.csv file.
    Only includes foods that are in the foundation_food.csv.
    """
    print("Loading food.csv...")
    food_df = pd.read_csv(csv_dir / "food.csv")

    # Filter only foundation foods
    food_df = food_df[food_df['fdc_id'].isin(foundation_ids)]
    print(f"  Found {len(food_df)} foundation foods")

    # Create output dataframe
    foods = []
    now = datetime.now(timezone.utc).isoformat()

    for _, row in food_df.iterrows():
        fdc_id = str(int(row['fdc_id']))
        description = str(row['description']).strip()

        if not description:
            continue

        # Get category name
        cat_id = row.get('food_category_id')
        category = None
        if pd.notna(cat_id):
            category = categories.get(int(cat_id))
            if category:
                category = category[:50]  # Limit to 50 chars

        food_id = str(uuid.uuid4())

        foods.append({
            'id': food_id,
            'fdc_id': fdc_id,  # Keep for nutrient linking
            'name': description[:255],
            'name_normalized': normalize_name(description)[:255],
            'category': category,
            'serving_size_g': Decimal("100.00"),
            'serving_unit': 'g',
            'calorie_per_100g': None,  # Will be filled from nutrients
            'usda_id': fdc_id,
            'source': 'USDA',
            'is_verified': True,
            'embedding': None,
            'created_at': now,
            'updated_at': now,
        })

    return pd.DataFrame(foods)


def process_nutrients(csv_dir: Path, food_ids: set) -> dict:
    """
    Process nutrients from USDA food_nutrient.csv file.
    Returns dict: {fdc_id: {nutrient_field: average_value}}
    """
    print("Loading food_nutrient.csv...")
    nutrient_df = pd.read_csv(csv_dir / "food_nutrient.csv")

    # Filter only for foods we care about
    nutrient_df = nutrient_df[nutrient_df['fdc_id'].isin(food_ids)]
    print(f"  Found {len(nutrient_df)} nutrient records for foundation foods")

    # Aggregate nutrients per food
    nutrients = defaultdict(lambda: defaultdict(list))

    for _, row in nutrient_df.iterrows():
        fdc_id = int(row['fdc_id'])
        nutrient_id = int(row['nutrient_id'])
        amount = row['amount']

        # Check if this nutrient maps to a field we need
        field_name = NUTRIENT_MAP.get(nutrient_id)
        if not field_name:
            continue

        if pd.notna(amount):
            nutrients[fdc_id][field_name].append(float(amount))

    # Average the values (some foods have multiple samples)
    result = {}
    for fdc_id, fields in nutrients.items():
        result[fdc_id] = {}
        for field_name, values in fields.items():
            if values:
                avg = sum(values) / len(values)
                result[fdc_id][field_name] = parse_decimal(avg)

    return result


def create_output_dataframes(foods_df: pd.DataFrame, nutrients: dict) -> tuple:
    """
    Create final dataframes for foods and food_nutrients tables.
    """
    now = datetime.now(timezone.utc).isoformat()

    # Update foods with calorie data and prepare food_nutrients
    food_nutrients = []

    for idx, row in foods_df.iterrows():
        fdc_id = int(row['fdc_id'])
        food_id = row['id']

        nutrient_data = nutrients.get(fdc_id, {})

        # Set calorie_per_100g on food
        if 'calories_100g' in nutrient_data:
            foods_df.at[idx, 'calorie_per_100g'] = nutrient_data['calories_100g']

        # Create food_nutrient record
        food_nutrient = {
            'id': str(uuid.uuid4()),
            'food_id': food_id,
            'calories_100g': nutrient_data.get('calories_100g'),
            'protein_g_100g': nutrient_data.get('protein_g_100g'),
            'carbs_g_100g': nutrient_data.get('carbs_g_100g'),
            'fat_g_100g': nutrient_data.get('fat_g_100g'),
            'saturated_fat_g_100g': nutrient_data.get('saturated_fat_g_100g'),
            'fiber_g_100g': nutrient_data.get('fiber_g_100g'),
            'sugar_g_100g': nutrient_data.get('sugar_g_100g'),
            'sodium_mg_100g': nutrient_data.get('sodium_mg_100g'),
            'calcium_mg_100g': nutrient_data.get('calcium_mg_100g'),
            'iron_mg_100g': nutrient_data.get('iron_mg_100g'),
            'vitamin_c_mg_100g': nutrient_data.get('vitamin_c_mg_100g'),
            'created_at': now,
            'updated_at': now,
        }
        food_nutrients.append(food_nutrient)

    # Remove fdc_id column (not in final schema)
    foods_final = foods_df.drop(columns=['fdc_id'])

    return foods_final, pd.DataFrame(food_nutrients)


def main():
    print("=== USDA Foundation Foods Processing ===\n")

    # Verify data directory
    if not CSV_DIR.exists():
        print(f"Error: Data directory not found: {CSV_DIR}")
        return

    # Create output directory
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Load category mapping
    print("Loading categories...")
    categories = load_categories(CSV_DIR)
    print(f"  Found {len(categories)} categories")

    # Load foundation food IDs
    print("Loading foundation food IDs...")
    foundation_ids = load_foundation_food_ids(CSV_DIR)
    print(f"  Found {len(foundation_ids)} foundation food IDs")

    # Process foods
    foods_df = process_foods(CSV_DIR, categories, foundation_ids)
    print(f"  Processed {len(foods_df)} foods")

    # Process nutrients
    food_fdc_ids = set(foods_df['fdc_id'].astype(int))
    nutrients = process_nutrients(CSV_DIR, food_fdc_ids)
    print(f"  Processed nutrients for {len(nutrients)} foods")

    # Create final dataframes
    print("\nCreating output dataframes...")
    foods_final, nutrients_final = create_output_dataframes(foods_df, nutrients)

    # Filter out foods without any nutrient data
    foods_with_nutrients = set(nutrients_final[nutrients_final['calories_100g'].notna()]['food_id'])
    foods_final = foods_final[foods_final['id'].isin(foods_with_nutrients)]
    nutrients_final = nutrients_final[nutrients_final['food_id'].isin(foods_with_nutrients)]

    print(f"  Foods with nutrient data: {len(foods_final)}")

    # Save to CSV
    foods_output = OUTPUT_DIR / "foods.csv"
    nutrients_output = OUTPUT_DIR / "food_nutrients.csv"

    print(f"\nSaving to {foods_output}...")
    foods_final.to_csv(foods_output, index=False, quoting=csv.QUOTE_ALL)

    print(f"Saving to {nutrients_output}...")
    nutrients_final.to_csv(nutrients_output, index=False, quoting=csv.QUOTE_ALL)

    print("\n=== Processing Complete ===")
    print(f"Foods: {len(foods_final)}")
    print(f"Food Nutrients: {len(nutrients_final)}")
    print(f"\nOutput files:")
    print(f"  - {foods_output}")
    print(f"  - {nutrients_output}")

    # Print sample data
    print("\n--- Sample Foods ---")
    print(foods_final[['name', 'category', 'calorie_per_100g']].head(10).to_string())

    print("\n--- Sample Nutrients ---")
    sample_cols = ['calories_100g', 'protein_g_100g', 'carbs_g_100g', 'fat_g_100g']
    print(nutrients_final[sample_cols].head(10).to_string())


if __name__ == "__main__":
    main()
