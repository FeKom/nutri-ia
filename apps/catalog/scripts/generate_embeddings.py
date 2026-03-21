import sys
from pathlib import Path

# Adiciona o diretório raiz do projeto ao Python path
root_dir = Path(__file__).parent.parent
sys.path.insert(0, str(root_dir))

from app.database.database import engine
from app.models.food import Food, FoodNutrient
from app.services.embedding_service import generate_food_embedding
from sqlmodel import Session, select

# Tenta importar line_profiler, mas funciona sem ele também
try:
    profile = __builtins__.profile  # type: ignore
except AttributeError:
    # Se não estiver rodando com kernprof, profile não faz nada
    def profile(func):
        return func

@profile
def generate_all_embeddings():
    """Gera embeddings para todos os alimentos no banco"""

    with Session(engine) as session:
        # Buscar todos os alimentos com nutrients
        statement = (
            select(Food, FoodNutrient)
            .join(FoodNutrient, Food.id == FoodNutrient.food_id, isouter=True)
        )
        results = session.exec(statement).all()

        count = 0
        for food, nutrients in results:
            # Gerar embedding usando a função standalone
            embedding = generate_food_embedding(food, nutrients)

            # Atualizar alimento
            food.embedding = embedding
            session.add(food)
            count += 1

            if count % 10 == 0:
                print(f"Processados {count} alimentos...")

        session.commit()
        print(f"✅ Embeddings gerados para {count} alimentos")

if __name__ == "__main__":
    generate_all_embeddings()