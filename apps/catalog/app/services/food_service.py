from typing import Dict, List, Optional, Tuple
from sqlmodel import Session, select, or_, col
from uuid import UUID
import logging
from app.models.food import Food, FoodNutrient
from app.schemas.food import FoodSearchFilters

logger = logging.getLogger(__name__)


def search_foods(
    session: Session,
    query: str,
    limit: int = 10,
    filters: Optional[FoodSearchFilters] = None
) -> List[Food]:
    """
    Search for foods using text-based search with optional filters

    Args:
        session: Database session
        query: Search query string
        limit: Maximum number of results to return
        filters: Optional filters for category, nutrients, etc.

    Returns:
        List of Food objects matching the search criteria
    """
    # Start with base query
    statement = select(Food).join(FoodNutrient, Food.id == FoodNutrient.food_id, isouter=True)

    # Text search on name and name_normalized (case-insensitive)
    search_term = f"%{query.lower()}%"
    statement = statement.where(
        or_(
            col(Food.name).ilike(search_term),
            col(Food.name_normalized).ilike(search_term)
        )
    )

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
    query: str,
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
    from app.services.embedding_service import generate_embedding

    # Gera embedding da query
    logger.info(f"Generating embedding for query: '{query}'")
    query_embedding = generate_embedding(query)

    # Busca por similaridade usando pgvector cosine_distance
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

    # Ordena por similaridade (menor distance = maior similaridade)
    statement = statement.order_by("distance").limit(limit)

    results = session.exec(statement).all()

    # Converte distance (0-2) para similarity (0-1): similarity = 1 - distance
    similar_foods = [(food, round(1 - distance, 4)) for food, distance in results]

    # Filtra por threshold de similaridade mínima
    if min_similarity > 0.0:
        similar_foods = [(food, score) for food, score in similar_foods if score >= min_similarity]

    logger.info(f"Found {len(similar_foods)} foods similar to '{query}'")
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

    logger.info(f"Resolving {len(queries)} food queries in batch")
    embeddings = generate_embeddings_batch(queries)

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
