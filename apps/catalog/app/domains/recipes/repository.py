from typing import List, Optional, Protocol, Tuple
from uuid import UUID

import sqlalchemy as sa
from sqlmodel import Session, col, func, or_, select

from app.models.recipe import Recipe
from app.schemas.recipe import RecipeCreate, RecipeUpdate


class RecipeRepository(Protocol):
    def get_by_id(self, recipe_id: UUID) -> Optional[Recipe]: ...
    def list_all(
        self,
        category: Optional[str],
        difficulty: Optional[str],
        max_prep_time: Optional[int],
        max_calories: Optional[int],
        min_protein: Optional[float],
        limit: int,
        offset: int,
    ) -> Tuple[List[Recipe], int]: ...
    def search(
        self,
        query: str,
        category: Optional[str],
        difficulty: Optional[str],
        max_prep_time: Optional[int],
        max_calories: Optional[int],
        min_protein: Optional[float],
        limit: int,
        offset: int,
    ) -> Tuple[List[Recipe], int]: ...
    def create(self, data: RecipeCreate) -> Recipe: ...
    def update(self, recipe_id: UUID, data: RecipeUpdate) -> Optional[Recipe]: ...
    def delete(self, recipe_id: UUID) -> bool: ...


class SQLModelRecipeRepository:
    def __init__(self, session: Session) -> None:
        self._s = session

    def get_by_id(self, recipe_id: UUID) -> Optional[Recipe]:
        return self._s.exec(select(Recipe).where(Recipe.id == recipe_id)).first()

    def list_all(
        self,
        category=None,
        difficulty=None,
        max_prep_time=None,
        max_calories=None,
        min_protein=None,
        limit=20,
        offset=0,
    ) -> Tuple[List[Recipe], int]:
        stmt = select(Recipe)
        stmt = self._apply_filters(
            stmt, category, difficulty, max_prep_time, max_calories, min_protein
        )
        total = self._s.exec(select(func.count()).select_from(stmt.subquery())).one()
        recipes = list(
            self._s.exec(
                stmt.order_by(Recipe.created_at.desc()).offset(offset).limit(limit)
            ).all()
        )
        return recipes, total

    def search(
        self,
        query: str,
        category=None,
        difficulty=None,
        max_prep_time=None,
        max_calories=None,
        min_protein=None,
        limit=20,
        offset=0,
    ) -> Tuple[List[Recipe], int]:
        t = f"%{query.lower()}%"
        stmt = select(Recipe).where(
            or_(
                col(Recipe.name).ilike(t),
                col(Recipe.description).ilike(t),
                func.cast(Recipe.ingredients, sa.Text).ilike(t),
            )
        )
        stmt = self._apply_filters(
            stmt, category, difficulty, max_prep_time, max_calories, min_protein
        )
        total = self._s.exec(select(func.count()).select_from(stmt.subquery())).one()
        recipes = list(
            self._s.exec(
                stmt.order_by(Recipe.created_at.desc()).offset(offset).limit(limit)
            ).all()
        )
        return recipes, total

    def create(self, data: RecipeCreate) -> Recipe:
        recipe = Recipe(**data.model_dump())
        self._s.add(recipe)
        self._s.commit()
        self._s.refresh(recipe)
        return recipe

    def update(self, recipe_id: UUID, data: RecipeUpdate) -> Optional[Recipe]:
        recipe = self.get_by_id(recipe_id)
        if not recipe:
            return None
        for k, v in data.model_dump(exclude_unset=True).items():
            setattr(recipe, k, v)
        self._s.add(recipe)
        self._s.commit()
        self._s.refresh(recipe)
        return recipe

    def delete(self, recipe_id: UUID) -> bool:
        recipe = self.get_by_id(recipe_id)
        if not recipe:
            return False
        self._s.delete(recipe)
        self._s.commit()
        return True

    @staticmethod
    def _apply_filters(
        stmt, category, difficulty, max_prep_time, max_calories, min_protein
    ):
        if category:
            stmt = stmt.where(Recipe.category == category)
        if difficulty:
            stmt = stmt.where(Recipe.difficulty == difficulty)
        if max_prep_time is not None:
            stmt = stmt.where(Recipe.prep_time_minutes <= max_prep_time)
        if max_calories is not None:
            stmt = stmt.where(Recipe.calories <= max_calories)
        if min_protein is not None:
            stmt = stmt.where(Recipe.protein_g >= min_protein)
        return stmt
