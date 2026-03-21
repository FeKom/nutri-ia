from typing import Generic, TypeVar, Optional
from pydantic import BaseModel, Field

T = TypeVar('T')


class PaginationParams(BaseModel):
    """Pagination parameters"""
    limit: int = Field(default=10, ge=1, le=100, description="Number of items to return")
    offset: int = Field(default=0, ge=0, description="Number of items to skip")


class PaginatedResponse(BaseModel, Generic[T]):
    """Generic paginated response"""
    success: bool = True
    data: list[T]
    count: int
    limit: int
    offset: int
    total: Optional[int] = None


class StandardResponse(BaseModel, Generic[T]):
    """Standard API response"""
    success: bool = True
    data: Optional[T] = None
    message: Optional[str] = None
    error: Optional[str] = None
