from datetime import date as date_type
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class ActivityLogCreate(BaseModel):
    type: str
    duration_minutes: int
    calories_burned: int
    date: date_type
    notes: Optional[str] = None


class ActivityLogResponse(BaseModel):
    id: UUID
    user_id: UUID
    type: str
    duration_minutes: int
    calories_burned: int
    date: date_type
    notes: Optional[str]
    created_at: str

    class Config:
        from_attributes = True
