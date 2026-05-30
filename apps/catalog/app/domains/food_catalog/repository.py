import logging
import re
from typing import Dict, List, Optional, Protocol, Tuple
from uuid import UUID

from sqlalchemy import text as sa_text
from sqlmodel import Session, col, or_, select

from app.domains.food_catalog.exceptions import EmptyQueryError
from app.domains.food_catalog.schemas import FoodSearchFilters
from app.models.food import Food, FoodNutrient

logger = logging.getLogger(__name__)

_COOKING_METHODS = re.compile(
    r"\b("
    r"coz[ií]d[oa]s?|grelhad[oa]s?|assad[oa]s?|fritad[oa]s?|frit[oa]s?|"
    r"refogad[oa]s?|cru[a]?s?|na\s+vapor|no\s+vapor|escaldad[oa]s?|"
    r"defumad[oa]s?|curad[oa]s?|marinado[a]?s?|temperado[a]?s?|"
    r"boiled|grilled|roasted|baked|fried|raw|steamed|smoked|poached|sautéed|sauteed"
    r")\b",
    re.IGNORECASE,
)
_QUANTITIES = re.compile(
    r"\b\d+[\.,]?\d*\s*(g|kg|ml|l|mg|cal|kcal|oz|lb|cup|tbsp|tsp|colher[es]*|xícar[as]*|unidade[s]*|fatia[s]*|porção|porcao)\b"
    r"|\b\d+\s*(g|kg|ml|l)\b"
    r"|\b(meio|meia|um|uma|dois|duas)\s+\w+",
    re.IGNORECASE,
)


def _normalize(query: List[str]) -> List[str]:
    results = []
    for q in query:
        n = _QUANTITIES.sub("", q)
        n = _COOKING_METHODS.sub("", n)
        n = " ".join(n.split()).strip() or q.strip()
        if n:
            results.append(n)
    if not results:
        raise EmptyQueryError()
    return results


class FoodRepository(Protocol):
    def get_by_id(self, food_id: UUID) -> Optional[Food]: ...
    def get_with_nutrients(self, food_id: UUID) -> Optional[Food]: ...
    def get_by_ids(self, food_ids: List[UUID]) -> List[Food]: ...
    def search(
        self, query: List[str], limit: int, filters: Optional[FoodSearchFilters]
    ) -> List[Food]: ...
    def search_by_embedding(
        self,
        query: List[str],
        limit: int,
        filters: Optional[FoodSearchFilters],
        min_similarity: float,
    ) -> List[Tuple[Food, float]]: ...
    def find_similar(
        self, food_id: UUID, limit: int, same_category: bool
    ) -> List[Tuple[Food, float]]: ...
    def resolve_batch(
        self, queries: List[str], min_similarity: float, limit_per_query: int
    ) -> Dict[str, List[Tuple[Food, float]]]: ...


class SQLModelFoodRepository:
    def __init__(self, session: Session) -> None:
        self._s = session

    def get_by_id(self, food_id: UUID) -> Optional[Food]:
        return self._s.exec(select(Food).where(Food.id == food_id)).first()

    def get_with_nutrients(self, food_id: UUID) -> Optional[Food]:
        return self._s.exec(
            select(Food)
            .where(Food.id == food_id)
            .join(FoodNutrient, Food.id == FoodNutrient.food_id, isouter=True)
        ).first()

    def get_by_ids(self, food_ids: List[UUID]) -> List[Food]:
        return list(self._s.exec(select(Food).where(col(Food.id).in_(food_ids))).all())

    def search(
        self,
        query: List[str],
        limit: int = 10,
        filters: Optional[FoodSearchFilters] = None,
    ) -> List[Food]:
        stmt = select(Food).join(
            FoodNutrient, Food.id == FoodNutrient.food_id, isouter=True
        )
        conditions = []
        for term in query:
            t = f"%{term.lower()}%"
            conditions.append(col(Food.name).ilike(t))
            conditions.append(col(Food.name_normalized).ilike(t))
        stmt = stmt.where(or_(*conditions))
        stmt = self._filters(stmt, filters)
        return list(self._s.exec(stmt.limit(limit)).all())

    def search_by_embedding(
        self,
        query: List[str],
        limit: int = 10,
        filters: Optional[FoodSearchFilters] = None,
        min_similarity: float = 0.0,
    ) -> List[Tuple[Food, float]]:
        from app.services.embedding_service import generate_embeddings_batch

        normalized = _normalize(query)
        embeddings = generate_embeddings_batch(normalized, is_query=True)
        best: Dict[str, Tuple[Food, float]] = {}

        for qtext, qemb in zip(normalized, embeddings):
            stmt = select(
                Food, Food.embedding.cosine_distance(qemb).label("distance")
            ).where(Food.embedding.isnot(None))
            stmt = self._filters(stmt, filters)
            candidates = self._s.exec(stmt.order_by("distance").limit(limit * 2)).all()
            if not candidates:
                continue
            food_ids = [f.id for f, _ in candidates]
            trgm = {
                r.id: float(r.trgm)
                for r in self._s.execute(
                    sa_text(
                        "SELECT id, similarity(name, :q) AS trgm FROM foods WHERE id = ANY(:ids)"
                    ),
                    {"q": qtext, "ids": food_ids},
                ).fetchall()
            }
            for food, dist in candidates:
                score = round(
                    0.85 * (1 - float(dist)) + 0.15 * trgm.get(food.id, 0.0), 4
                )
                fid = str(food.id)
                if fid not in best or best[fid][1] < score:
                    best[fid] = (food, score)

        result = sorted(best.values(), key=lambda x: x[1], reverse=True)[:limit]
        if min_similarity > 0:
            result = [(f, s) for f, s in result if s >= min_similarity]
        return result

    def find_similar(
        self, food_id: UUID, limit: int = 10, same_category: bool = False
    ) -> List[Tuple[Food, float]]:
        ref = self._s.exec(select(Food).where(Food.id == food_id)).first()
        if not ref or ref.embedding is None:
            return []
        stmt = select(
            Food, Food.embedding.cosine_distance(ref.embedding).label("distance")
        )
        stmt = stmt.where(Food.id != food_id).where(Food.embedding.isnot(None))
        if same_category and ref.category:
            stmt = stmt.where(Food.category == ref.category)
        return [
            (f, round(1 - d, 4))
            for f, d in self._s.exec(stmt.order_by("distance").limit(limit)).all()
        ]

    def resolve_batch(
        self, queries: List[str], min_similarity: float = 0.4, limit_per_query: int = 1
    ) -> Dict[str, List[Tuple[Food, float]]]:
        from app.services.embedding_service import generate_embeddings_batch

        normalized = [_normalize([q])[0] for q in queries]
        embeddings = generate_embeddings_batch(normalized, is_query=True)
        results: Dict[str, List[Tuple[Food, float]]] = {}
        for qtext, qemb in zip(queries, embeddings):
            rows = self._s.exec(
                select(Food, Food.embedding.cosine_distance(qemb).label("distance"))
                .where(Food.embedding.isnot(None))
                .order_by("distance")
                .limit(limit_per_query)
            ).all()
            results[qtext] = [
                (f, round(1 - d, 4))
                for f, d in rows
                if round(1 - d, 4) >= min_similarity
            ]
        return results

    @staticmethod
    def _filters(stmt, filters: Optional[FoodSearchFilters]):
        if not filters:
            return stmt
        if filters.category:
            stmt = stmt.where(Food.category == filters.category)
        if filters.source:
            stmt = stmt.where(Food.source == filters.source)
        if filters.verified_only:
            stmt = stmt.where(Food.is_verified == True)  # noqa: E712
        if filters.min_protein is not None:
            stmt = stmt.where(FoodNutrient.protein_g_100g >= filters.min_protein)
        if filters.max_calories is not None:
            stmt = stmt.where(
                or_(
                    Food.calorie_per_100g <= filters.max_calories,
                    FoodNutrient.calories_100g <= filters.max_calories,
                )
            )
        return stmt
