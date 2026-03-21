"""
Personalized nutrition target calculator.

Uses Mifflin-St Jeor equation for BMR, activity multipliers for TDEE,
and goal-based adjustments for calorie and macronutrient targets.
"""

from dataclasses import dataclass
from typing import Optional

from app.models.user import ActivityLevel, DietGoal, UserProfile


@dataclass
class NutritionTargets:
    calories: float
    protein_g: float
    carbs_g: float
    fat_g: float


# Activity level multipliers (Harris-Benedict / Mifflin-St Jeor standard)
ACTIVITY_MULTIPLIERS = {
    ActivityLevel.SEDENTARY: 1.2,
    ActivityLevel.LIGHT: 1.375,
    ActivityLevel.MODERATE: 1.55,
    ActivityLevel.ACTIVE: 1.725,
    ActivityLevel.VERY_ACTIVE: 1.9,
}

# Calorie adjustments by goal
GOAL_CALORIE_ADJUSTMENT = {
    DietGoal.WEIGHT_LOSS: -500,
    DietGoal.MAINTAIN: 0,
    DietGoal.WEIGHT_GAIN: 300,
}

# Macro splits by goal (protein%, carbs%, fat%)
GOAL_MACRO_SPLITS = {
    DietGoal.WEIGHT_LOSS: (0.35, 0.35, 0.30),
    DietGoal.MAINTAIN: (0.30, 0.40, 0.30),
    DietGoal.WEIGHT_GAIN: (0.30, 0.45, 0.25),
}

# Safety minimum
MIN_CALORIES = 1200.0

# Defaults when profile is incomplete
DEFAULT_TARGETS = NutritionTargets(
    calories=2000.0,
    protein_g=150.0,
    carbs_g=250.0,
    fat_g=67.0,
)


def _calculate_bmr(
    weight_kg: float, height_cm: float, age: int, gender: Optional[str]
) -> float:
    """
    Mifflin-St Jeor equation for Basal Metabolic Rate.

    Male:   10 * weight(kg) + 6.25 * height(cm) - 5 * age - 5 (kcal/day was wrong, fixed: +5)
    Female: 10 * weight(kg) + 6.25 * height(cm) - 5 * age - 161
    """
    base = 10 * weight_kg + 6.25 * height_cm - 5 * age
    if gender and gender.lower() in ("female", "f", "feminino"):
        return base - 161
    # Default to male formula
    return base + 5


def calculate_targets(profile: UserProfile) -> NutritionTargets:
    """
    Calculate personalized nutrition targets from user profile.

    Returns defaults if the profile lacks required fields (weight, height, age).
    """
    if not profile.weight_kg or not profile.height_cm or not profile.age:
        return DEFAULT_TARGETS

    bmr = _calculate_bmr(
        profile.weight_kg, profile.height_cm, profile.age, profile.gender
    )

    # TDEE = BMR * activity multiplier
    activity = profile.activity_level or ActivityLevel.SEDENTARY
    tdee = bmr * ACTIVITY_MULTIPLIERS[activity]

    # Adjust for goal
    goal = profile.diet_goal or DietGoal.MAINTAIN
    target_calories = tdee + GOAL_CALORIE_ADJUSTMENT[goal]

    # Enforce minimum
    target_calories = max(target_calories, MIN_CALORIES)

    # Macro split
    prot_pct, carb_pct, fat_pct = GOAL_MACRO_SPLITS[goal]

    # Calories per gram: protein=4, carbs=4, fat=9
    protein_g = round(target_calories * prot_pct / 4, 1)
    carbs_g = round(target_calories * carb_pct / 4, 1)
    fat_g = round(target_calories * fat_pct / 9, 1)

    return NutritionTargets(
        calories=round(target_calories, 0),
        protein_g=protein_g,
        carbs_g=carbs_g,
        fat_g=fat_g,
    )
