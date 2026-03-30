#!/usr/bin/env python3
"""
Re-gera embeddings de todos os alimentos no banco com o novo modelo multilingual.
Necessário após trocar all-MiniLM-L6-v2 → paraphrase-multilingual-MiniLM-L12-v2.

Uso:
    python scripts/re_embed_foods.py
    python scripts/re_embed_foods.py --batch-size 100
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.food import Food, FoodNutrient
from app.services.embedding_service import generate_food_description, generate_embeddings_batch


def re_embed_all(db_url: str, batch_size: int = 100):
    engine = create_engine(str(db_url))

    with Session(engine) as session:
        foods = session.exec(select(Food)).all() if hasattr(session, "exec") else session.query(Food).all()
        total = len(foods)
        print(f"🔄 Re-embedando {total} alimentos com paraphrase-multilingual-MiniLM-L12-v2...\n")

        for start in range(0, total, batch_size):
            batch = foods[start:start + batch_size]

            descriptions = []
            for food in batch:
                nutrient = session.query(FoodNutrient).filter(FoodNutrient.food_id == food.id).first()
                descriptions.append(generate_food_description(food, nutrient))

            embeddings = generate_embeddings_batch(descriptions)

            for food, emb in zip(batch, embeddings):
                food.embedding = emb

            session.commit()
            done = min(start + batch_size, total)
            print(f"   ✅ {done}/{total} ({done*100//total}%)")

    print("\n🎉 Re-embedding concluído!")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--batch-size", type=int, default=100)
    parser.add_argument("--db-url", type=str, default=None)
    args = parser.parse_args()

    db_url = args.db_url or settings.DATABASE_URL
    if not db_url:
        print("❌ DATABASE_URL não configurada.")
        sys.exit(1)

    re_embed_all(db_url, args.batch_size)
