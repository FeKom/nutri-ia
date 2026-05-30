import enum
from typing import Optional
from uuid import UUID

from pgvector.sqlalchemy import Vector
from sqlalchemy import Column, ForeignKey, Text
from sqlalchemy import Enum as SQLEnum
from sqlmodel import Field, SQLModel

from app.models.base import TimestampMixin, UUIDMixin


class DocumentStatus(str, enum.Enum):
    PENDING = "pending"
    INDEXED = "indexed"
    FAILED = "failed"


class Document(UUIDMixin, TimestampMixin, SQLModel, table=True):
    __tablename__ = "documents"

    user_id: str = Field(max_length=255, nullable=False, index=True)
    name: str = Field(max_length=255, nullable=False)
    b2_key: str = Field(max_length=512, nullable=False)
    mime_type: str = Field(default="application/pdf", max_length=100)
    size_bytes: Optional[int] = Field(default=None)
    page_count: Optional[int] = Field(default=None)
    status: DocumentStatus = Field(
        default=DocumentStatus.PENDING,
        sa_column=Column(SQLEnum(DocumentStatus), nullable=False, index=True),
    )
    error_message: Optional[str] = Field(default=None, max_length=1024)


class BlobChunk(UUIDMixin, TimestampMixin, SQLModel, table=True):
    __tablename__ = "blob_chunks"

    document_id: UUID = Field(
        sa_column=Column(
            ForeignKey("documents.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        )
    )
    chunk_index: int = Field(nullable=False)
    content: str = Field(sa_column=Column(Text, nullable=False))
    page_number: Optional[int] = Field(default=None)
    chunk_size: int = Field(nullable=False)
    chunk_overlap: int = Field(nullable=False)
    embedding_model: str = Field(default="intfloat/multilingual-e5-base", max_length=100)
    embedding: Optional[list[float]] = Field(
        default=None,
        sa_column=Column(Vector(768), nullable=True),
    )
