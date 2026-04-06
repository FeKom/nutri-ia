from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

from app.api.dependencies import get_db
from app.schemas.food import (
    NutritionCalculationRequest,
    NutritionCalculationResponse,
    MacrosRequest,
    MacrosResponse,
    MacrosProfileUsed,
)
from app.services import nutrition_service

router = APIRouter()


@router.post("/calculate", response_model=NutritionCalculationResponse)
async def calculate_nutrition(
    request: NutritionCalculationRequest, db: Session = Depends(get_db)
) -> NutritionCalculationResponse:
    """
    Calculate total nutrition for a list of foods

    This endpoint calculates the total nutritional values for a combination of foods
    with specified quantities.

    **Request Body:**
    - `foods`: Array of food items with quantities (required)
        - `food_id`: UUID of the food item
        - `quantity`: Quantity in grams (must be > 0)

    **Response:**
    - `success`: Boolean indicating success
    - `total`: Object with total nutritional values
        - `calories`: Total calories
        - `protein_g`: Total protein in grams
        - `carbs_g`: Total carbohydrates in grams
        - `fat_g`: Total fat in grams
        - `saturated_fat_g`: Total saturated fat in grams
        - `fiber_g`: Total fiber in grams
        - `sugar_g`: Total sugar in grams
        - `sodium_mg`: Total sodium in milligrams
        - `calcium_mg`: Total calcium in milligrams
        - `iron_mg`: Total iron in milligrams
        - `vitamin_c_mg`: Total vitamin C in milligrams
    - `details`: Array of nutritional breakdown per food item
        - `food_id`: UUID of the food
        - `food_name`: Name of the food
        - `quantity_g`: Quantity in grams
        - `calories`: Calories for this food
        - `protein_g`: Protein for this food
        - `carbs_g`: Carbs for this food
        - `fat_g`: Fat for this food

    **Example Request:**
    ```json
    {
        "foods": [
            {
                "food_id": "550e8400-e29b-41d4-a716-446655440000",
                "quantity": 150
            },
            {
                "food_id": "550e8400-e29b-41d4-a716-446655440001",
                "quantity": 100
            }
        ]
    }
    ```

    **Example Response:**
    ```json
    {
        "success": true,
        "total": {
            "calories": 350.5,
            "protein_g": 45.2,
            "carbs_g": 12.5,
            "fat_g": 8.3,
            ...
        },
        "details": [
            {
                "food_id": "550e8400-e29b-41d4-a716-446655440000",
                "food_name": "Chicken Breast",
                "quantity_g": 150,
                "calories": 248.5,
                "protein_g": 37.5,
                "carbs_g": 0,
                "fat_g": 5.5
            },
            ...
        ]
    }
    ```
    """
    try:
        totals, details = nutrition_service.calculate_nutrition(db, request.foods)

        return NutritionCalculationResponse(success=True, total=totals, details=details)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error calculating nutrition: {str(e)}",
        )


_ACTIVITY_FACTORS = {
    "sedentary": 1.2,
    "light": 1.375,
    "moderate": 1.55,
    "active": 1.725,
    "very_active": 1.9,
}

_CALORIE_ADJUSTMENTS = {
    "weight_loss": -500,
    "weight_gain": 500,
    "maintain": 0,
}

_GOAL_NAMES = {
    "weight_loss": "perda de peso",
    "weight_gain": "ganho de peso",
    "maintain": "manutenção",
}

_ACTIVITY_NAMES = {
    "sedentary": "sedentário",
    "light": "levemente ativo",
    "moderate": "moderadamente ativo",
    "active": "muito ativo",
    "very_active": "extremamente ativo",
}


@router.post("/macros", response_model=MacrosResponse)
def calculate_macros(request: MacrosRequest) -> MacrosResponse:
    """
    Calculate daily macro targets using the Mifflin-St Jeor formula.

    Returns BMR, TDEE, and optimal macro distribution based on the user's
    physical profile and dietary goal.
    """
    w, h, a, g = request.weight_kg, request.height_cm, request.age, request.gender.value

    # Mifflin-St Jeor BMR
    base = 10 * w + 6.25 * h - 5 * a
    gender_adj = 5 if g == "male" else (-161 if g == "female" else -78)
    tmb = round(base + gender_adj, 1)

    # TDEE
    tdee = round(tmb * _ACTIVITY_FACTORS[request.activity_level.value], 1)

    # Calorie target
    adjustment = _CALORIE_ADJUSTMENTS[request.diet_goal.value]
    daily_calories = round(tdee + adjustment, 1)

    # Protein: higher during weight loss/gain to preserve/build muscle
    protein_per_kg = {"weight_loss": 2.0, "weight_gain": 2.2, "maintain": 1.6}[request.diet_goal.value]
    protein_g = round(w * protein_per_kg, 1)

    fat_g = round((daily_calories * 0.28) / 9, 1)
    carbs_g = round((daily_calories - protein_g * 4 - fat_g * 9) / 4, 1)

    goal_name = _GOAL_NAMES[request.diet_goal.value]
    activity_name = _ACTIVITY_NAMES[request.activity_level.value]
    gender_pt = "masculino" if g == "male" else ("não binário" if g == "non_binary" else "feminino")

    explanation = (
        f"Baseado no seu perfil ({w}kg, {h}cm, {a} anos, {gender_pt}):\n\n"
        f"📊 **Cálculos Nutricionais**\n"
        f"• TMB (metabolismo basal): {tmb} kcal/dia\n"
        f"• TDEE (gasto total com atividade {activity_name}): {tdee} kcal/dia\n"
        f"• Meta ajustada para {goal_name}: {daily_calories} kcal/dia\n\n"
        f"🍽️ **Distribuição de Macros**\n"
        f"• Proteína: {protein_g}g/dia ({protein_g / w:.1f}g/kg)\n"
        f"• Carboidratos: {carbs_g}g/dia\n"
        f"• Gordura: {fat_g}g/dia\n\n"
        f"💡 **Nota**: Estes valores são estimativas. Ajuste conforme necessário baseado nos resultados."
    )

    return MacrosResponse(
        tmb=tmb,
        tdee=tdee,
        daily_calories=daily_calories,
        daily_protein_g=protein_g,
        daily_carbs_g=carbs_g,
        daily_fat_g=fat_g,
        calorie_adjustment=adjustment,
        diet_goal=request.diet_goal.value,
        profile_used=MacrosProfileUsed(
            weight_kg=w,
            height_cm=h,
            age=a,
            gender=g,
            activity_level=request.activity_level.value,
            diet_goal=request.diet_goal.value,
        ),
        explanation=explanation,
    )
