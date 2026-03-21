from sentence_transformers import SentenceTransformer
from typing import TYPE_CHECKING, List
from decimal import Decimal
import logging

if TYPE_CHECKING:
    from app.models.food import Food, FoodNutrient

logger = logging.getLogger(__name__)

# Tenta importar line_profiler, mas funciona sem ele também
try:
    profile = __builtins__.profile  # type: ignore
except AttributeError:
    # Se não estiver rodando com kernprof, profile não faz nada
    def profile(func):
        return func


 #Thresholds da ANVISA para classificação nutricional.
    # Proteínas
HIGH_PROTEIN = Decimal("12")       # Alto teor de proteína
SOURCE_PROTEIN = Decimal("6")      # Fonte de proteína

# Fibras
HIGH_FIBER = Decimal("6")         # Alto teor de fibras
SOURCE_FIBER = Decimal("3")       # Fonte de fibras

# Gorduras
LOW_FAT = Decimal("3")            # Baixo teor de gordura
LOW_SATURATED_FAT = Decimal("1.5")  # Baixo teor de gordura saturada

# Açúcares e sódio
LOW_SUGAR = Decimal("5")          # Baixo teor de açúcar
LOW_SODIUM = Decimal("120")       # Baixo teor de sódio

# Calorias (não é ANVISA oficial, mas útil)
LOW_CALORIE = Decimal("40")       # Baixa caloria

_model = None


def _get_model() -> SentenceTransformer:
    """Lazy singleton — carrega o modelo uma única vez."""
    global _model
    if _model is None:
        logger.info("Carregando modelo SentenceTransformer (primeira chamada)...")
        _model = SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')
        logger.info("Modelo carregado.")
    return _model


@profile
def generate_embedding(text: str) -> List[float]:
    """
    Gera embedding para um texto usando sentence-transformers.

    Args:
        text: Texto para gerar embedding

    Returns:
        Lista de floats representando o embedding das palavras
        ex: [0.123, -0.234, ..., 0.456]
    """
    model = _get_model()
    try:
        embedding = model.encode(text, convert_to_numpy=True)
        return embedding.tolist()
    except Exception as e:
        logger.error(f"Erro ao gerar embedding: {e}")
        raise

@profile
def generate_embeddings_batch(texts: List[str]) -> List[List[float]]:
    """
    Gera embeddings para múltiplos textos em batch (mais eficiente que gerar um a um).

    Usa model.encode() nativo do SentenceTransformer que processa todos os textos
    juntos, aproveitando batching interno e GPU (se disponível).

    Args:
        texts: Lista de textos para gerar embeddings

    Returns:
        Lista de embeddings (cada um é uma lista de floats)
    """
    model = _get_model()
    try:
        embeddings = model.encode(texts, convert_to_numpy=True)
        return [emb.tolist() for emb in embeddings]
    except Exception as e:
        logger.error(f"Erro ao gerar embeddings em batch: {e}")
        raise


@profile
def generate_food_description(food: "Food", nutrients: "FoodNutrient") -> str:
    """
    Cria descrição rica do alimento para embedding baseada nos thresholds ANVISA.
    Args:
        food: O alimento
        nutrients: Os nutrientes do alimento
    Returns:
        Descrição textual enriquecida para gerar embedding semântico
    """
    parts = [food.name]

    if food.category:
        parts.append(f"Categoria: {food.category}.")

    if nutrients:
        if nutrients.protein_g_100g is not None:
            if nutrients.protein_g_100g >= HIGH_PROTEIN:
                parts.append("Alto teor de proteína.")
            elif nutrients.protein_g_100g >= SOURCE_PROTEIN:
                parts.append("Fonte de proteína.")
                
        #Fibras
        if nutrients.fiber_g_100g is not None:
            if nutrients.fiber_g_100g >= HIGH_FIBER:
                parts.append("alto teor de fibras")
            elif nutrients.fiber_g_100g >= SOURCE_FIBER:
                parts.append("fonte de fibras")

        # Gordura
        if nutrients.fat_g_100g is not None:
            if nutrients.fat_g_100g <= LOW_FAT:
                parts.append("baixo teor de gordura")

        # Gordura saturada
        if nutrients.saturated_fat_g_100g is not None:
            if nutrients.saturated_fat_g_100g <= LOW_SATURATED_FAT:
                parts.append("baixo teor de gordura saturada")

        # Açúcar
        if nutrients.sugar_g_100g is not None:
            if nutrients.sugar_g_100g <= LOW_SUGAR:
                parts.append("baixo teor de açúcar")

        # Sódio
        if nutrients.sodium_mg_100g is not None:
            if nutrients.sodium_mg_100g <= LOW_SODIUM:
                parts.append("baixo teor de sódio")

        # Calorias
        if nutrients.calories_100g is not None:
            if nutrients.calories_100g <= LOW_CALORIE:
                parts.append("baixa caloria")

    return " ".join(parts).strip().replace("  ", " ")

@profile
def generate_food_embedding(food: "Food", nutrients: "FoodNutrient") -> List[float]:
    """
    Gera embedding vetorial para um alimento baseado em sua descrição enriquecida.

    Args:
        food: O alimento
        nutrients: Os nutrientes do alimento

    Returns:
        Lista de floats representando o embedding do alimento
    """
    description = generate_food_description(food, nutrients)
    return generate_embedding(description)