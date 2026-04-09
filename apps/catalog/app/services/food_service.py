import re
from typing import Dict, List, Optional, Tuple
from sqlalchemy import text as sa_text
from sqlmodel import Session, select, or_, col
from uuid import UUID
import logging
from app.models.food import Food, FoodNutrient
from app.schemas.food import FoodSearchFilters

logger = logging.getLogger(__name__)

# Cooking methods and preparation terms to strip from queries (PT + EN)
     
_COOKING_METHODS: List[str] = re.compile(
    r"\b("
    r"coz[ií]d[oa]s?|grelhad[oa]s?|assad[oa]s?|fritad[oa]s?|fritd[oa]s?|frit[oa]s?|"
    r"refogad[oa]s?|ensopand[oa]s?|cru[a]?s?|na\s+vapor|no\s+vapor|"
    r"escaldad[oa]s?|defumad[oa]s?|curad[oa]s?|marinado[a]?s?|temperado[a]?s?|"
    r"boiled|grilled|roasted|baked|fried|raw|steamed|smoked|poached|sautéed|sauteed"
    r")\b",
    re.IGNORECASE,
)

# Quantity patterns: "50g", "100 ml", "2 colheres", "1 xícara", "meio", etc.
_QUANTITIES: List[str] = re.compile(
    r"\b\d+[\.,]?\d*\s*(g|kg|ml|l|mg|cal|kcal|oz|lb|cup|tbsp|tsp|colher[es]*|xícar[as]*|unidade[s]*|fatia[s]*|porção|porcao)\b"
    r"|\b\d+\s*(g|kg|ml|l)\b"
    r"|\b(meio|meia|um|uma|dois|duas)\s+\w+",
    re.IGNORECASE,
)


def _normalize_food_query(query: List[str]) -> List[str]:
    """
    Strip quantities and cooking methods from a food query before embedding.

    Examples:
        "ovo cozido 50g"        → "ovo"
        "arroz branco cozido"   → "arroz branco"
        "salmão cru 100g"       → "salmão"
        "frango grelhado"       → "frango"
        "egg boiled 2 units"    → "egg"
    """
    results = []

    for  q in query:
      normalized: List[str] = _QUANTITIES.sub("", q)
      normalized = _COOKING_METHODS.sub("", normalized)

      normalized = " ".join(normalized.split())  # collapse whitespace
      result = normalized.strip() or q.strip()  # fallback to original if empty
      if result != q.strip():
        logger.debug(f"[food_service] query normalized: '{q}' → '{result}'")
      if result:
        results.append(result)
        # Validação final: a lista resultante não pode ser vazia
    if not results:
      raise ValueError("Query cannot be empty")
            
    return results


def search_foods(
    session: Session,
    query: List[str],
    limit: int = 10,
    filters: Optional[FoodSearchFilters] = None
) -> List[Food]:
    """
    Search for foods using text-based search with optional filters

    Args:
        session: Database session
        query: List of search terms — each one generates an OR condition
        limit: Maximum number of results to return
        filters: Optional filters for category, nutrients, etc.

    Returns:
        List of Food objects matching the search criteria
    """
    # Start with base query
    statement = select(Food).join(FoodNutrient, Food.id == FoodNutrient.food_id, isouter=True)

    # Text search: OR across all query terms on name and name_normalized
    conditions = []
    for term in query:
        t = f"%{term.lower()}%"
        conditions.append(col(Food.name).ilike(t))
        conditions.append(col(Food.name_normalized).ilike(t))
    statement = statement.where(or_(*conditions))

    # Apply filters if provided
    if filters:
        if filters.category:
            statement = statement.where(Food.category == filters.category)

        if filters.source:
            statement = statement.where(Food.source == filters.source)

        if filters.verified_only:
            statement = statement.where(Food.is_verified == True)

        if filters.min_protein is not None:
            statement = statement.where(
                FoodNutrient.protein_g_100g >= filters.min_protein
            )

        if filters.max_calories is not None:
            statement = statement.where(
                or_(
                    Food.calorie_per_100g <= filters.max_calories,
                    FoodNutrient.calories_100g <= filters.max_calories
                )
            )

    # Limit results
    statement = statement.limit(limit)

    # Execute and return results
    results = session.exec(statement).all()
    return list(results)


def get_food_by_id(session: Session, food_id: UUID) -> Optional[Food]:
    """
    Get a food item by its ID

    Args:
        session: Database session
        food_id: UUID of the food item

    Returns:
        Food object if found, None otherwise
    """
    statement = select(Food).where(Food.id == food_id)
    return session.exec(statement).first()


def get_foods_by_ids(session: Session, food_ids: List[UUID]) -> List[Food]:
    """
    Get multiple food items by their IDs

    Args:
        session: Database session
        food_ids: List of food UUIDs

    Returns:
        List of Food objects
    """
    statement = select(Food).where(col(Food.id).in_(food_ids))
    results = session.exec(statement).all()
    return list(results)


def get_food_with_nutrients(session: Session, food_id: UUID) -> Optional[Food]:
    """
    Get a food item with its nutrients

    Args:
        session: Database session
        food_id: UUID of the food item

    Returns:
        Food object with nutrients if found, None otherwise
    """
    try:
        statement = (
            select(Food)
            .where(Food.id == food_id)
            .join(FoodNutrient, Food.id == FoodNutrient.food_id, isouter=True)
        )
        return session.exec(statement).first()
    except Exception as e:
        logger.error(f"Error fetching food with nutrients for ID {food_id}: {e}")
        return None
    
def search_foods_by_embedding(
    session: Session,
    query: List[str],
    limit: int = 10,
    filters: Optional[FoodSearchFilters] = None,
    min_similarity: float = 0.0
) -> List[tuple[Food, float]]:
    """
    Busca alimentos usando similaridade de embeddings (busca semântica).

    Gera embedding da query de busca e encontra alimentos com embeddings
    similares usando cosine distance (pgvector). Mais efetivo que busca textual
    para nomes complexos ou descritivos (ex: "chicken in creamy sauce").

    Args:
        session: Database session
        query: Search query string (ex: "grilled chicken", "white rice")
        limit: Maximum number of results to return
        filters: Optional filters for category, nutrients, etc.

    Returns:
        List of tuples (Food, similarity_score) ordered by similarity

    Example:
        results = search_foods_by_embedding(session, "chicken in creamy sauce", limit=5)
        for food, score in results:
            print(f"{food.name}: {score:.2f}")
    """
    from app.services.embedding_service import generate_embeddings_batch

    # Strip quantities and cooking methods before embedding
    normalized_queries: List[str] = _normalize_food_query(query)
    logger.info(f"Generating embeddings for queries: {normalized_queries} (original: {query})")

    # is_query=True adds "query: " prefix — required for E5 asymmetric search
    # (foods are indexed with "passage: ", queries must use "query: ")
    query_embeddings: List[List[float]] = generate_embeddings_batch(normalized_queries, is_query=True)

    fetch_limit = limit * 2

    # Collect best score per food across all query terms
    best_by_food: dict = {}  # food.id -> (Food, float)

    for query_text, query_embedding in zip(normalized_queries, query_embeddings):
        # query_embedding is List[float] — correct type for cosine_distance
        statement = select(
            Food,
            Food.embedding.cosine_distance(query_embedding).label("distance")
        ).where(Food.embedding.isnot(None))

        # Aplicar filtros opcionais
        if filters:
            if filters.category:
                statement = statement.where(Food.category == filters.category)

            if filters.source:
                statement = statement.where(Food.source == filters.source)

            if filters.verified_only:
                statement = statement.where(Food.is_verified == True)

            # Filtros de nutrientes requerem join
            if filters.min_protein is not None or filters.max_calories is not None:
                statement = statement.join(FoodNutrient, Food.id == FoodNutrient.food_id, isouter=True)

                if filters.min_protein is not None:
                    statement = statement.where(FoodNutrient.protein_g_100g >= filters.min_protein)

                if filters.max_calories is not None:
                    statement = statement.where(
                        or_(
                            Food.calorie_per_100g <= filters.max_calories,
                            FoodNutrient.calories_100g <= filters.max_calories
                        )
                    )

        statement = statement.order_by("distance").limit(fetch_limit)
        candidates = session.exec(statement).all()

        if not candidates:
            continue

        # Busca léxica: similarity() do pg_trgm para cada candidato.
        # query_text is a plain str — required by pg_trgm similarity()
        food_ids = [food.id for food, _ in candidates]
        trgm_rows = session.execute(
            sa_text(
                "SELECT id, similarity(name, :q) AS trgm "
                "FROM foods WHERE id = ANY(:ids)"
            ),
            {"q": query_text, "ids": food_ids},
        ).fetchall()
        trgm_by_id = {row.id: float(row.trgm) for row in trgm_rows}

        # Score híbrido: 85% vetor + 15% texto
        for food, distance in candidates:
            vec_score = round(1 - float(distance), 4)
            text_score = trgm_by_id.get(food.id, 0.0)
            hybrid = round(0.85 * vec_score + 0.15 * text_score, 4)

            food_id = str(food.id)
            if food_id not in best_by_food or best_by_food[food_id][1] < hybrid:
                best_by_food[food_id] = (food, hybrid)

    if not best_by_food:
        return []

    # Re-ordena pelo score híbrido e corta no limit original
    blended: List[tuple[Food, float]] = sorted(best_by_food.values(), key=lambda x: x[1], reverse=True)
    similar_foods = blended[:limit]

    # Filtra por threshold de similaridade mínima
    if min_similarity > 0.0:
        similar_foods = [(food, score) for food, score in similar_foods if score >= min_similarity]

    logger.info(f"Found {len(similar_foods)} foods for {len(normalized_queries)} queries (hybrid search)")
    if similar_foods:
        logger.debug(f"Top match: {similar_foods[0][0].name} (score: {similar_foods[0][1]})")

    return similar_foods


def find_similar_foods(
    session: Session,
    food_id: UUID,
    limit: int = 10,
    same_category: bool = False
) -> List[tuple[Food, float]]:
    """
    Encontra alimentos similares usando busca vetorial (pgvector).

    Args:
        session: Database session
        food_id: UUID of the reference food
        limit: Maximum number of similar foods to return
        same_category: If True, only return foods from same category

    Returns:
        List of tuples (Food, similarity_score)
    """
    # Busca o alimento de referência
    ref_food = session.exec(
        select(Food).where(Food.id == food_id)
    ).first()

    if not ref_food or ref_food.embedding is None:
        logger.warning(f"Food {food_id} not found or has no embedding")
        return []

    # Busca por similaridade usando cosine_distance
    query = select(
        Food,
        Food.embedding.cosine_distance(ref_food.embedding).label("distance")
    )
    query = query.where(Food.id != food_id)
    query = query.where(Food.embedding.isnot(None))

    if same_category and ref_food.category:
        query = query.where(Food.category == ref_food.category)

    query = query.order_by("distance").limit(limit)

    results = session.exec(query).all()

    # Converte distance para similarity (1 - distance)
    return [(food, round(1 - distance, 4)) for food, distance in results]


def resolve_foods(
    session: Session,
    queries: List[str],
    min_similarity: float = 0.4,
    limit_per_query: int = 1
) -> Dict[str, List[Tuple[Food, float]]]:
    """
    Resolve uma lista de nomes de alimentos em batch via embeddings.

    Gera embeddings para todas as queries de uma vez (mais eficiente)
    e busca o melhor match para cada uma no banco.

    Args:
        session: Database session
        queries: Lista de nomes de alimentos para resolver
        min_similarity: Threshold mínimo de similaridade (0-1)
        limit_per_query: Número de matches por query

    Returns:
        Dict mapeando cada query para lista de (Food, similarity_score).
        Queries sem match acima do threshold retornam lista vazia.
    """
    from app.services.embedding_service import generate_embeddings_batch

    normalized = [_normalize_food_query([q])[0] for q in queries]
    logger.info(f"Resolving {len(queries)} food queries in batch")
    embeddings = generate_embeddings_batch(normalized, is_query=True)

    results: Dict[str, List[Tuple[Food, float]]] = {}

    for query_text, query_embedding in zip(queries, embeddings):
        statement = select(
            Food,
            Food.embedding.cosine_distance(query_embedding).label("distance")
        ).where(
            Food.embedding.isnot(None)
        ).order_by("distance").limit(limit_per_query)

        rows = session.exec(statement).all()

        matches = []
        for food, distance in rows:
            similarity = round(1 - distance, 4)
            if similarity >= min_similarity:
                matches.append((food, similarity))

        results[query_text] = matches

    resolved_count = sum(1 for m in results.values() if m)
    logger.info(f"Resolved {resolved_count}/{len(queries)} foods above threshold {min_similarity}")

    return results
