from datetime import date
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class GoalCreate(BaseModel):
    title: str
    description: Optional[str] = None
    target_value: float
    current_value: float
    unit: str
    category: str
    deadline: Optional[date] = None


class GoalUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    target_value: Optional[float] = None
    current_value: Optional[float] = None
    deadline: Optional[date] = None


class GoalResponse(BaseModel):
    id: UUID
    user_id: UUID
    title: str
    description: Optional[str]
    target_value: float
    current_value: float
    unit: str
    category: str
    deadline: Optional[date]
    created_at: str

    class Config:
        from_attributes = True
