from typing import List, Optional, Protocol, Set
from uuid import UUID

from sqlalchemy import not_, or_
from sqlmodel import Session, select

from app.models.food import Food, FoodNutrient
from app.models.user import DietGoal, UserProfile


class RecommendationRepository(Protocol):
    def recommend_foods(
        self, profile: UserProfile, limit: Optional[int]
    ) -> List[Food]: ...
    def get_by_category(
        self, profile: UserProfile, category: str, limit: Optional[int]
    ) -> List[Food]: ...


class SQLModelRecommendationRepository:
    def __init__(self, session: Session) -> None:
        self._s = session

    def recommend_foods(
        self, profile: UserProfile, limit: Optional[int] = 50
    ) -> List[Food]:
        restrictions: Set[str] = set(profile.dietary_restrictions or [])
        allergies: Set[str] = set(profile.allergies or [])
        disliked: Set[str] = set(profile.disliked_foods or [])

        stmt = select(Food, FoodNutrient).join(
            FoodNutrient, Food.id == FoodNutrient.food_id, isouter=True
        )

        exclusions = self._build_exclusions(restrictions, allergies, disliked)
        if exclusions:
            stmt = stmt.where(not_(or_(*exclusions)))

        rows = self._s.exec(stmt.limit(1000)).all()
        scored = sorted(
            [
                (self._score(food, nutrients, profile.diet_goal), food)
                for food, nutrients in rows
            ],
            reverse=True,
        )
        foods = [food for _, food in scored]
        return foods[:limit] if limit else foods

    def get_by_category(
        self, profile: UserProfile, category: str, limit: Optional[int] = 20
    ) -> List[Food]:
        all_foods = self.recommend_foods(profile, limit=None)
        filtered = [
            f
            for f in all_foods
            if f.category and f.category.lower() == category.lower()
        ]
        return filtered[:limit] if limit else filtered

    @staticmethod
    def _score(food: Food, nutrients, diet_goal) -> float:
        score = 50.0
        if not nutrients or not diet_goal:
            return score
        protein = float(nutrients.protein_g_100g or 0)
        fat = float(nutrients.fat_g_100g or 0)
        fiber = float(nutrients.fiber_g_100g or 0)
        carbs = float(nutrients.carbs_g_100g or 0)
        calories = float(food.calorie_per_100g or 0)
        if diet_goal == DietGoal.WEIGHT_LOSS:
            if protein >= 15:
                score += 15
            if fiber >= 5:
                score += 10
            if calories < 150:
                score += 15
            if fat < 5:
                score += 10
        elif diet_goal == DietGoal.WEIGHT_GAIN:
            if protein >= 15:
                score += 20
            if calories >= 250:
                score += 15
            if carbs >= 30:
                score += 10
        elif diet_goal == DietGoal.MAINTAIN:
            if 10 <= protein <= 25:
                score += 10
            if 100 <= calories <= 250:
                score += 10
            if fiber >= 3:
                score += 5
        if food.is_verified:
            score += 5
        return min(score, 100.0)

    _RESTRICTIONS = {
        "vegetariano": [
            "carne",
            "frango",
            "peixe",
            "bacon",
            "presunto",
            "meat",
            "chicken",
            "fish",
            "beef",
            "pork",
        ],
        "vegano": [
            "carne",
            "frango",
            "peixe",
            "leite",
            "queijo",
            "ovo",
            "mel",
            "manteiga",
            "iogurte",
            "meat",
            "chicken",
            "fish",
            "milk",
            "cheese",
            "egg",
            "honey",
            "butter",
            "yogurt",
        ],
        "sem_gluten": [
            "trigo",
            "centeio",
            "cevada",
            "aveia",
            "pão",
            "massa",
            "wheat",
            "rye",
            "barley",
            "oat",
            "bread",
            "pasta",
        ],
        "sem_lactose": [
            "leite",
            "queijo",
            "iogurte",
            "manteiga",
            "creme",
            "milk",
            "cheese",
            "yogurt",
            "butter",
            "cream",
        ],
    }
    _ALLERGENS = {
        "amendoim": ["amendoim", "peanut"],
        "gluten": [
            "trigo",
            "centeio",
            "cevada",
            "aveia",
            "pão",
            "massa",
            "wheat",
            "rye",
            "barley",
            "oat",
        ],
        "lactose": [
            "leite",
            "queijo",
            "iogurte",
            "manteiga",
            "creme",
            "milk",
            "cheese",
            "yogurt",
            "butter",
        ],
        "ovo": ["ovo", "egg"],
        "soja": ["soja", "tofu", "soy"],
        "peixe": [
            "peixe",
            "salmão",
            "atum",
            "sardinha",
            "bacalhau",
            "fish",
            "salmon",
            "tuna",
        ],
    }

    def _build_exclusions(
        self, restrictions: Set[str], allergies: Set[str], disliked: Set[str]
    ):
        conditions = []
        for r in restrictions:
            terms = self._RESTRICTIONS.get(r.lower(), [])
            if terms:
                conditions.append(
                    or_(
                        *[
                            Food.name.ilike(f"%{t}%")
                            for t in terms  # type: ignore
                        ]
                        + [Food.category.ilike(f"%{t}%") for t in terms]
                    )
                )  # type: ignore
        for a in allergies:
            al = a.lower()
            terms = self._ALLERGENS.get(al, [al])
            conditions.append(or_(*[Food.name.ilike(f"%{t}%") for t in terms]))  # type: ignore
        for d in disliked:
            conditions.append(Food.name.ilike(f"%{d.lower()}%"))  # type: ignore
        return conditions
