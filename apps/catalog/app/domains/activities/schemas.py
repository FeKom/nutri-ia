from datetime import date
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class ActivityLogCreate(BaseModel):
    type: str
    duration_minutes: int
    calories_burned: int
    date: date
    notes: Optional[str] = None


class ActivityLogResponse(BaseModel):
    id: UUID
    user_id: UUID
    type: str
    duration_minutes: int
    calories_burned: int
    date: date
    notes: Optional[str]
    created_at: str

    class Config:
        from_attributes = True
