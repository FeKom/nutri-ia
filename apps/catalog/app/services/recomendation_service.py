import logging
from typing import List, Optional, Set

from sqlalchemy import or_, and_, not_
from sqlmodel import Session, select

from app.models.food import Food, FoodNutrient
from app.models.user import UserProfile, DietGoal


logger = logging.getLogger(__name__)


def _calculate_food_score(food: Food, nutrients: Optional[FoodNutrient], diet_goal: Optional[DietGoal]) -> float:
    """
    Calculate a relevance score for a food based on user's diet goal.

    Higher score = better match for user's goals.

    Args:
        food: Food object
        nutrients: FoodNutrient object (can be None)
        diet_goal: User's diet goal

    Returns:
        Score from 0-100
    """
    base_score = 50.0  # Neutral score

    if not nutrients or not diet_goal:
        return base_score

    # Extract nutrient values (per 100g)
    protein = float(nutrients.protein_g_100g or 0)
    carbs = float(nutrients.carbs_g_100g or 0)
    fat = float(nutrients.fat_g_100g or 0)
    fiber = float(nutrients.fiber_g_100g or 0)
    calories = float(food.calorie_per_100g or 0)

    score = base_score

    # Adjust score based on diet goal
    if diet_goal == DietGoal.WEIGHT_LOSS:
        # Prefer: high protein, high fiber, low calories, low fat
        if protein >= 15:  # High protein (>= 15g/100g)
            score += 15
        if fiber >= 5:  # High fiber (>= 5g/100g)
            score += 10
        if calories < 150:  # Low calorie (< 150 kcal/100g)
            score += 15
        if fat < 5:  # Low fat (< 5g/100g)
            score += 10

    elif diet_goal == DietGoal.WEIGHT_GAIN:
        # Prefer: high calories, high protein, moderate carbs
        if protein >= 15:  # High protein
            score += 20
        if calories >= 250:  # High calorie (>= 250 kcal/100g)
            score += 15
        if carbs >= 30:  # Moderate-high carbs
            score += 10

    elif diet_goal == DietGoal.MAINTAIN:
        # Prefer: balanced nutrients, moderate calories
        if 10 <= protein <= 25:  # Moderate protein
            score += 10
        if 100 <= calories <= 250:  # Moderate calories
            score += 10
        if fiber >= 3:  # Some fiber
            score += 5

    # Bonus for verified foods
    if food.is_verified:
        score += 5

    return min(score, 100.0)  # Cap at 100


def _normalize_text(text: str) -> str:
    """Normalize text for comparison (lowercase, strip whitespace)."""
    return text.lower().strip()


def _food_matches_restriction(food: Food, restrictions: Set[str]) -> bool:
    """
    Check if a food matches any dietary restriction.
    Returns True if the food should be EXCLUDED.
    """
    if not restrictions:
        return False

    food_name_normalized = _normalize_text(food.name)
    food_category = _normalize_text(food.category) if food.category else ""

    restriction_mappings = {
        "vegetariano": ["carne", "frango", "peixe", "bacon", "presunto", "salsicha", "linguiça", "meat", "chicken", "fish", "beef", "pork"],
        "vegano": ["carne", "frango", "peixe", "leite", "queijo", "ovo", "mel", "manteiga", "iogurte", "meat", "chicken", "fish", "milk", "cheese", "egg", "honey", "butter", "yogurt"],
        "sem_gluten": ["trigo", "centeio", "cevada", "aveia", "pão", "massa", "wheat", "rye", "barley", "oat", "bread", "pasta", "gluten"],
        "sem_lactose": ["leite", "queijo", "iogurte", "manteiga", "creme", "milk", "cheese", "yogurt", "butter", "cream", "lactose"],
        "kosher": ["porco", "bacon", "presunto", "camarão", "lagosta", "pork", "shrimp", "lobster"],
        "halal": ["porco", "bacon", "presunto", "álcool", "pork", "alcohol"],
    }

    for restriction in restrictions:
        restriction_lower = _normalize_text(restriction)
        if restriction_lower in restriction_mappings:
            excluded_terms = restriction_mappings[restriction_lower]
            for term in excluded_terms:
                if term in food_name_normalized or term in food_category:
                    return True

    return False


def _food_contains_allergen(food: Food, allergies: Set[str]) -> bool:
    """
    Check if a food contains any allergen.
    Returns True if the food should be EXCLUDED.
    """
    if not allergies:
        return False

    food_name_normalized = _normalize_text(food.name)
    food_category = _normalize_text(food.category) if food.category else ""

    allergen_mappings = {
        "amendoim": ["amendoim", "peanut"],
        "nozes": ["nozes", "castanha", "amêndoa", "avelã", "nut", "almond", "hazelnut", "walnut", "cashew"],
        "gluten": ["trigo", "centeio", "cevada", "aveia", "pão", "massa", "wheat", "rye", "barley", "oat", "bread", "pasta", "gluten"],
        "lactose": ["leite", "queijo", "iogurte", "manteiga", "creme", "milk", "cheese", "yogurt", "butter", "cream", "lactose"],
        "ovo": ["ovo", "egg"],
        "soja": ["soja", "tofu", "soy"],
        "frutos_do_mar": ["camarão", "lagosta", "caranguejo", "ostra", "mexilhão", "shrimp", "lobster", "crab", "oyster", "mussel", "shellfish"],
        "peixe": ["peixe", "salmão", "atum", "sardinha", "bacalhau", "fish", "salmon", "tuna", "sardine", "cod"],
    }

    for allergy in allergies:
        allergy_lower = _normalize_text(allergy)

        if allergy_lower in food_name_normalized or allergy_lower in food_category:
            return True

        if allergy_lower in allergen_mappings:
            allergen_terms = allergen_mappings[allergy_lower]
            for term in allergen_terms:
                if term in food_name_normalized or term in food_category:
                    return True

    return False


def _food_is_disliked(food: Food, disliked_foods: Set[str]) -> bool:
    """
    Check if a food is in the user's disliked foods list.
    Returns True if the food should be EXCLUDED.
    """
    if not disliked_foods:
        return False

    food_name_normalized = _normalize_text(food.name)

    for disliked in disliked_foods:
        disliked_normalized = _normalize_text(disliked)
        if disliked_normalized in food_name_normalized or food_name_normalized in disliked_normalized:
            return True

    return False


def _build_exclusion_filters(restrictions: Set[str], allergies: Set[str], disliked_foods: Set[str]):
    """
    Build SQL WHERE clauses to exclude foods based on restrictions, allergies, and dislikes.

    Returns a list of conditions that should be combined with AND_ (all must be false).
    """
    exclusion_conditions = []

    # Mapping of restrictions to excluded terms
    restriction_mappings = {
        "vegetariano": ["carne", "frango", "peixe", "bacon", "presunto", "salsicha", "linguiça", "meat", "chicken", "fish", "beef", "pork"],
        "vegano": ["carne", "frango", "peixe", "leite", "queijo", "ovo", "mel", "manteiga", "iogurte", "meat", "chicken", "fish", "milk", "cheese", "egg", "honey", "butter", "yogurt"],
        "sem_gluten": ["trigo", "centeio", "cevada", "aveia", "pão", "massa", "wheat", "rye", "barley", "oat", "bread", "pasta", "gluten"],
        "sem_lactose": ["leite", "queijo", "iogurte", "manteiga", "creme", "milk", "cheese", "yogurt", "butter", "cream", "lactose"],
        "kosher": ["porco", "bacon", "presunto", "camarão", "lagosta", "pork", "shrimp", "lobster"],
        "halal": ["porco", "bacon", "presunto", "álcool", "pork", "alcohol"],
    }

    allergen_mappings = {
        "amendoim": ["amendoim", "peanut"],
        "nozes": ["nozes", "castanha", "amêndoa", "avelã", "nut", "almond", "hazelnut", "walnut", "cashew"],
        "gluten": ["trigo", "centeio", "cevada", "aveia", "pão", "massa", "wheat", "rye", "barley", "oat", "bread", "pasta", "gluten"],
        "lactose": ["leite", "queijo", "iogurte", "manteiga", "creme", "milk", "cheese", "yogurt", "butter", "cream", "lactose"],
        "ovo": ["ovo", "egg"],
        "soja": ["soja", "tofu", "soy"],
        "frutos_do_mar": ["camarão", "lagosta", "caranguejo", "ostra", "mexilhão", "shrimp", "lobster", "crab", "oyster", "mussel", "shellfish"],
        "peixe": ["peixe", "salmão", "atum", "sardinha", "bacalhau", "fish", "salmon", "tuna", "sardine", "cod"],
    }

    # Build restriction exclusions
    for restriction in restrictions:
        restriction_lower = _normalize_text(restriction)
        if restriction_lower in restriction_mappings:
            terms = restriction_mappings[restriction_lower]
            # Exclude if name or category contains any term
            term_conditions = []
            for term in terms:
                term_conditions.append(Food.name.ilike(f"%{term}%"))  # type: ignore
                term_conditions.append(Food.category.ilike(f"%{term}%"))  # type: ignore
            # Exclude if ANY term matches
            exclusion_conditions.append(or_(*term_conditions))

    # Build allergen exclusions
    for allergy in allergies:
        allergy_lower = _normalize_text(allergy)
        # Direct match
        exclusion_conditions.append(Food.name.ilike(f"%{allergy_lower}%"))  # type: ignore
        exclusion_conditions.append(Food.category.ilike(f"%{allergy_lower}%"))  # type: ignore

        # Mapped terms
        if allergy_lower in allergen_mappings:
            terms = allergen_mappings[allergy_lower]
            term_conditions = []
            for term in terms:
                term_conditions.append(Food.name.ilike(f"%{term}%"))  # type: ignore
                term_conditions.append(Food.category.ilike(f"%{term}%"))  # type: ignore
            exclusion_conditions.append(or_(*term_conditions))

    # Build disliked food exclusions
    for disliked in disliked_foods:
        disliked_normalized = _normalize_text(disliked)
        exclusion_conditions.append(Food.name.ilike(f"%{disliked_normalized}%"))  # type: ignore

    return exclusion_conditions


def recommend_foods(
    session: Session,
    profile: UserProfile,
    limit: Optional[int] = 50
) -> List[Food]:
    """
    Recommends foods based on user dietary restrictions, allergies, and disliked foods.

    Filters out foods that:
    - Match dietary restrictions (e.g., meat for vegetarians)
    - Contain allergens the user is allergic to
    - Are in the user's disliked foods list

    Args:
        session: Database session
        profile: UserProfile object containing user preferences
        limit: Maximum number of foods to return (default: 50)

    Returns:
        List of recommended food items that are safe and preferred for the user
    """
    restrictions: Set[str] = set(profile.dietary_restrictions or [])
    allergies: Set[str] = set(profile.allergies or [])
    disliked_foods: Set[str] = set(profile.disliked_foods or [])

    has_filters = bool(restrictions or allergies or disliked_foods)

    # Join with nutrients for scoring
    statement = (
        select(Food, FoodNutrient)
        .join(FoodNutrient, Food.id == FoodNutrient.food_id, isouter=True)  # type: ignore
    )

    if has_filters:
        logger.info(
            f"Filtering recommendations for user {profile.id}: "
            f"restrictions={restrictions}, allergies={allergies}, disliked={disliked_foods}"
        )

        # Build exclusion conditions (foods to exclude)
        exclusion_conditions = _build_exclusion_filters(restrictions, allergies, disliked_foods)

        if exclusion_conditions:
            # Exclude foods that match ANY exclusion condition
            # Use NOT(OR(...)) to exclude if any condition is true
            statement = statement.where(not_(or_(*exclusion_conditions)))
    else:
        logger.info(f"No dietary restrictions for user {profile.id}, returning all foods.")

    # Fetch foods with nutrients (no limit yet - we need to score first)
    # Apply a reasonable upper limit to prevent loading entire database
    MAX_CANDIDATES = 1000
    statement = statement.limit(MAX_CANDIDATES)

    results = session.exec(statement).all()

    # Calculate scores and sort by relevance
    scored_foods = []
    for food, nutrients in results:
        score = _calculate_food_score(food, nutrients, profile.diet_goal)
        scored_foods.append((score, food))

    # Sort by score descending (highest score first)
    scored_foods.sort(reverse=True, key=lambda x: x[0])

    # Take top N after scoring
    if limit:
        scored_foods = scored_foods[:limit]

    foods = [food for score, food in scored_foods]

    logger.info(
        f"Returning {len(foods)} recommended foods for user {profile.id} "
        f"(scored and ranked by relevance to {profile.diet_goal})"
    )
    return foods


def get_foods_by_category(
    session: Session,
    profile: UserProfile,
    category: str,
    limit: Optional[int] = 20
) -> List[Food]:
    """
    Get recommended foods filtered by category.

    Args:
        session: Database session
        profile: UserProfile object containing user preferences
        category: Food category to filter by
        limit: Maximum number of foods to return

    Returns:
        List of recommended foods in the specified category
    """
    all_recommended = recommend_foods(session, profile, limit=None)

    category_normalized = _normalize_text(category)
    filtered = [
        food for food in all_recommended
        if food.category and _normalize_text(food.category) == category_normalized
    ]

    if limit:
        filtered = filtered[:limit]

    logger.info(f"Returning {len(filtered)} foods in category '{category}' for user {profile.id}")
    return filtered