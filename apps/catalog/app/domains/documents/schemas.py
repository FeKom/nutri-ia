from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel

from app.models.documents import DocumentStatus


class UploadUrlRequest(BaseModel):
    name: str
    mime_type: str = "application/pdf"


class UploadUrlResponse(BaseModel):
    document_id: UUID
    upload_url: str
    b2_key: str
    expires_in: int = 900


class ConfirmUploadResponse(BaseModel):
    document_id: UUID
    status: DocumentStatus
    size_bytes: Optional[int]


class DownloadUrlResponse(BaseModel):
    download_url: str
    expires_in: int = 3600


class DocumentResponse(BaseModel):
    id: UUID
    name: str
    b2_key: str
    mime_type: str
    size_bytes: Optional[int]
    page_count: Optional[int]
    status: DocumentStatus
    created_at: datetime
