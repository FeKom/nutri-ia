#!/usr/bin/env python3
"""
Importa dados do TACO (Tabela Brasileira de Composição de Alimentos).

Estrutura real do Excel (por índice de coluna):
  0  → Número do alimento / nome da categoria
  1  → Descrição do alimento
  2  → Umidade (%)
  3  → Energia (kcal)       → calories_100g
  4  → Energia (kJ)
  5  → Proteína (g)         → protein_g_100g
  6  → Lipídeos (g)         → fat_g_100g
  7  → Colesterol (mg)
  8  → Carboidrato (g)      → carbs_g_100g
  9  → Fibra Alimentar (g)  → fiber_g_100g
  10 → Cinzas (g)
  11 → Cálcio (mg)          → calcium_mg_100g
  12 → Magnésio (mg)
  13 → (duplica nº alimento)
  14 → Manganês (mg)
  15 → Fósforo (mg)
  16 → Ferro (mg)            → iron_mg_100g
  17 → Sódio (mg)            → sodium_mg_100g
  18 → Potássio (mg)
  19 → Cobre (mg)
  20 → Zinco (mg)
  21 → Retinol (mcg)
  22 → RE (mcg)
  23 → RAE (mcg)
  24 → Tiamina (mg)
  25 → Riboflavina (mg)
  26 → Piridoxina (mg)
  27 → Niacina (mg)
  28 → Vitamina C (mg)       → vitamin_c_mg_100g

Uso:
    python scripts/import_taco.py
    python scripts/import_taco.py --dry-run
"""

import argparse
import sys
import unicodedata
from decimal import Decimal
from pathlib import Path
from typing import Optional

import pandas as pd

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.food import Food, FoodNutrient, FoodSource
from app.services.embedding_service import generate_embedding, generate_food_description

SHEET_NAME = "CMVCol taco3"
HEADER_ROWS = 3  # linhas 0-2 são cabeçalho

CATEGORY_MAPPING = {
    "Cereais e derivados": "grains",
    "Verduras, hortaliças e derivados": "vegetables",
    "Frutas e derivados": "fruits",
    "Gorduras e óleos": "fats",
    "Pescados e frutos do mar": "seafood",
    "Carnes e derivados": "meat",
    "Leite e derivados": "dairy",
    "Bebidas (alcoólicas e não alcoólicas)": "beverages",
    "Ovos e derivados": "eggs",
    "Produtos açucarados": "sweets",
    "Miscelâneas": "other",
    "Outros alimentos industrializados": "processed",
    "Alimentos preparados": "prepared",
    "Leguminosas e derivados": "legumes",
    "Nozes e sementes": "nuts",
}


def normalize_name(name: str) -> str:
    nfkd = unicodedata.normalize("NFKD", name)
    no_accents = "".join(c for c in nfkd if not unicodedata.combining(c))
    return " ".join(no_accents.lower().split())


def to_decimal(value) -> Optional[Decimal]:
    if pd.isna(value):
        return None
    if isinstance(value, str):
        v = value.strip().lower()
        if v in ("tr", "traço", "nd", "na", "-", ""):
            return None
        v = v.replace(",", ".")
        try:
            d = Decimal(v)
            return None if d < 0 else round(d, 2)
        except Exception:
            return None
    try:
        d = Decimal(str(value))
        return None if d < 0 else round(d, 2)
    except Exception:
        return None


def parse_taco_excel(file_path: Path):
    """
    Lê o Excel do TACO e retorna lista de dicts com os dados sanitizados.
    Detecta linhas de categoria (col0=texto, col1=NaN) e linhas de alimento (col0=número).
    """
    df = pd.read_excel(file_path, sheet_name=SHEET_NAME, header=None, skiprows=HEADER_ROWS)
    print(f"   {len(df)} linhas após pular cabeçalho")

    records = []
    current_category = "other"

    for _, row in df.iterrows():
        col0 = row.iloc[0]
        col1 = row.iloc[1]

        # Linha de categoria: col0 é texto não-numérico e col1 é NaN
        if isinstance(col0, str) and pd.isna(col1):
            current_category = CATEGORY_MAPPING.get(col0.strip(), "other")
            continue

        # Linha de alimento: col0 é número
        try:
            int(float(col0))
        except (ValueError, TypeError):
            continue

        name = str(col1).strip() if not pd.isna(col1) else None
        if not name or name == "nan":
            continue

        records.append({
            "name": name,
            "category": current_category,
            "calories": to_decimal(row.iloc[3]),
            "protein": to_decimal(row.iloc[5]),
            "fat": to_decimal(row.iloc[6]),
            "carbs": to_decimal(row.iloc[8]),
            "fiber": to_decimal(row.iloc[9]),
            "calcium": to_decimal(row.iloc[11]),
            "iron": to_decimal(row.iloc[16]),
            "sodium": to_decimal(row.iloc[17]),
            "vitamin_c": to_decimal(row.iloc[28]),
        })

    return records


def import_taco(file_path: Path, db_url: str, dry_run: bool, batch_size: int):
    print(f"\n📂 Lendo {file_path}...")
    records = parse_taco_excel(file_path)
    print(f"✅ {len(records)} alimentos encontrados\n")

    if dry_run:
        print("🔍 DRY-RUN — primeiros 5 alimentos:")
        for r in records[:5]:
            print(f"  {r['name']} | cat={r['category']} | kcal={r['calories']} | prot={r['protein']}g")
        print("\n💡 Execute sem --dry-run para importar.")
        return

    engine = create_engine(str(db_url))
    session = Session(engine)

    imported = skipped = errors = 0

    for i, r in enumerate(records):
        try:
            name_norm = normalize_name(r["name"])

            if session.query(Food).filter(Food.name_normalized == name_norm).first():
                skipped += 1
                continue

            food = Food(
                name=r["name"],
                name_normalized=name_norm,
                category=r["category"],
                serving_size_g=Decimal("100.00"),
                serving_unit="g",
                calorie_per_100g=r["calories"],
                source=FoodSource.TACO,
                is_verified=True,
                usda_id=None,
            )
            session.add(food)
            session.flush()

            nutrient = FoodNutrient(
                food_id=food.id,
                calories_100g=r["calories"],
                protein_g_100g=r["protein"],
                carbs_g_100g=r["carbs"],
                fat_g_100g=r["fat"],
                fiber_g_100g=r["fiber"],
                calcium_mg_100g=r["calcium"],
                iron_mg_100g=r["iron"],
                sodium_mg_100g=r["sodium"],
                vitamin_c_mg_100g=r["vitamin_c"],
            )
            session.add(nutrient)

            # Gera embedding usando o mesmo modelo do sistema (multilingual)
            description = generate_food_description(food, nutrient)
            food.embedding = generate_embedding(description)

            imported += 1

            if imported % batch_size == 0:
                session.commit()
                print(f"   💾 {imported} importados...")

        except Exception as e:
            print(f"   ❌ Erro em '{r.get('name')}': {e}")
            session.rollback()
            errors += 1

    session.commit()
    session.close()

    print(f"\n{'='*50}")
    print(f"✅ Importados:  {imported}")
    print(f"⚠️  Pulados:     {skipped} (já existiam)")
    print(f"❌ Erros:       {errors}")
    print(f"{'='*50}")


def main():
    parser = argparse.ArgumentParser(description="Importa TACO para o banco Nutria")
    parser.add_argument("--file", type=Path, default=Path("data/taco_data.xlsx"))
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--batch-size", type=int, default=50)
    parser.add_argument("--db-url", type=str, default=None)
    args = parser.parse_args()

    if not args.file.exists():
        print(f"❌ Arquivo não encontrado: {args.file}")
        sys.exit(1)

    db_url = args.db_url or settings.DATABASE_URL
    if not db_url:
        print("❌ DATABASE_URL não configurada.")
        sys.exit(1)

    import_taco(args.file, db_url, args.dry_run, args.batch_size)


if __name__ == "__main__":
    main()
