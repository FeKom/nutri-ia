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
        _model = SentenceTransformer('intfloat/multilingual-e5-small')
        logger.info("Modelo carregado.")
    return _model


@profile
def generate_embedding(text: str, is_query: bool = True) -> List[float]:
    """
    Gera embedding para um texto usando multilingual-e5-small.
    E5 usa prefixos assimétricos: 'query:' para buscas, 'passage:' para documentos.

    Args:
        text: Texto para gerar embedding
        is_query: True para queries de busca, False para documentos (alimentos)
    """
    model = _get_model()
    prefix = "query: " if is_query else "passage: "
    try:
        embedding = model.encode(prefix + text, convert_to_numpy=True, normalize_embeddings=True)
        return embedding.tolist()
    except Exception as e:
        logger.error(f"Erro ao gerar embedding: {e}")
        raise

@profile
def generate_embeddings_batch(texts: List[str], is_query: bool = False) -> List[List[float]]:
    """
    Gera embeddings em batch. Por padrão usa 'passage:' (documentos a indexar).

    Args:
        texts: Lista de textos
        is_query: False para documentos (indexação), True para queries de busca
    """
    model = _get_model()
    prefix = "query: " if is_query else "passage: "
    prefixed = [prefix + t for t in texts]
    try:
        embeddings = model.encode(prefixed, convert_to_numpy=True, normalize_embeddings=True)
        return [emb.tolist() for emb in embeddings]
    except Exception as e:
        logger.error(f"Erro ao gerar embeddings em batch: {e}")
        raise


def _sanitize_food_name(name: str) -> str:
    """
    Converte nomes estruturados (TACO/USDA) em texto natural para embedding.
    'Ovo, de galinha, inteiro, cozido/10minutos' → 'ovo de galinha inteiro cozido'
    'Chicken, breast, boneless, skinless, raw'  → 'chicken breast boneless skinless raw'
    """
    import re
    # Remove descrições de tempo após '/' (ex: "cozido/10minutos" → "cozido")
    name = re.sub(r'/\w+', '', name)
    # Substitui vírgulas e pontos por espaço
    name = name.replace(',', ' ').replace('.', ' ')
    # Normaliza espaços múltiplos
    return ' '.join(name.split()).lower()


@profile
def generate_food_description(food: "Food", nutrients: "FoodNutrient") -> str:
    """
    Gera texto do alimento para embedding semântico.
    Sanitiza nomes estruturados TACO/USDA em linguagem natural.
    """
    parts = [_sanitize_food_name(food.name)]
    if food.category:
        parts.append(food.category)
    return " ".join(parts).strip()

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
    return generate_embedding(description, is_query=False)