from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

from app.api.dependencies import get_db
from app.schemas.food import (
    NutritionCalculationRequest,
    NutritionCalculationResponse,
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
