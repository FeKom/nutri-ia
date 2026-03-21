from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import foods, meal_plans, nutrition, recommendations, tracking, users
from app.core.config import settings

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.PROJECT_VERSION,
    redirect_slashes=False,
    description="""
    Nutria Food Catalog API - A comprehensive food and nutrition database API.

    This API provides:
    * **Food Search**: Search for foods with text queries and filters
    * **Nutrition Calculations**: Calculate nutritional values for food combinations
    * **Semantic Search**: AI-powered semantic search for finding similar foods (coming soon)

    Designed to be consumed by AI agents (Mastra.ai) for nutritional assistance.
    """,
    openapi_tags=[
        {"name": "health", "description": "Health check endpoints"},
        {"name": "foods", "description": "Food search and retrieval operations"},
        {"name": "nutrition", "description": "Nutritional calculations and analysis"},
        {
            "name": "recommendations",
            "description": "Personalized food recommendations based on user profile",
        },
        {"name": "tracking", "description": "Meal logging and nutrition tracking"},
        {"name": "users", "description": "User profile management"},
        {"name": "meal-plans", "description": "Meal plan management and diet creation"},
    ],
)

# CORS Configuration
if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin) for origin in settings.BACKEND_CORS_ORIGINS],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Include routers with /api/v1 prefix
app.include_router(foods.router, prefix=f"{settings.API_V1_STR}/foods", tags=["foods"])
app.include_router(
    nutrition.router, prefix=f"{settings.API_V1_STR}/nutrition", tags=["nutrition"]
)
app.include_router(
    recommendations.router,
    prefix=f"{settings.API_V1_STR}/recommendations",
    tags=["recommendations"],
)
app.include_router(
    tracking.router, prefix=f"{settings.API_V1_STR}/tracking", tags=["tracking"]
)
app.include_router(users.router, prefix=f"{settings.API_V1_STR}/users", tags=["users"])
app.include_router(
    meal_plans.router, prefix=f"{settings.API_V1_STR}/meal-plans", tags=["meal-plans"]
)

# Also include routers with /api prefix for backward compatibility
app.include_router(foods.router, prefix="/api/foods", tags=["foods"])
app.include_router(nutrition.router, prefix="/api/nutrition", tags=["nutrition"])
app.include_router(
    recommendations.router, prefix="/api/recommendations", tags=["recommendations"]
)
app.include_router(tracking.router, prefix="/api/tracking", tags=["tracking"])
app.include_router(users.router, prefix="/api/users", tags=["users"])
app.include_router(meal_plans.router, prefix="/api/meal-plans", tags=["meal-plans"])


@app.get("/", tags=["health"])
async def root():
    """Root endpoint - API information"""
    return {
        "message": "Nutria Food Catalog API",
        "version": settings.PROJECT_VERSION,
        "docs_url": "/docs",
        "status": "healthy",
    }


@app.get("/health", tags=["health"])
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": settings.PROJECT_VERSION,
    }
