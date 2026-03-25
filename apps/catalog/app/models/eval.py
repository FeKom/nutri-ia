from typing import Optional, List
from uuid import UUID
from sqlmodel import Field, SQLModel, Column
from sqlalchemy import JSON, Index, Enum as SQLEnum
from pgvector.sqlalchemy import Vector
import enum

from app.models.base import TimestampMixin, UUIDMixin


class SourceType(str, enum.Enum):
    PDF = "pdf"
    MARKDOWN = "markdown"
    TEXT = "text"


class DocumentChunk(UUIDMixin, TimestampMixin, SQLModel, table=True):
    """
    Represents a chunk of a document for RAG evaluation datasets.
    """
    __tablename__ = "document_chunks"

    content: str = Field(nullable=False)
    embedding: Optional[List[float]] = Field(
        default=None,
        sa_column=Column(Vector(384), nullable=True),
    )
    source_name: str = Field(nullable=False, index=True)
    source_type: SourceType = Field(
        sa_column=Column(SQLEnum(SourceType), nullable=False)
    )
    chunk_index: int = Field(nullable=False)
    chunk_size: int = Field(nullable=False)
    chunk_overlap: int = Field(nullable=False)
    embedding_model: str = Field(default="all-MiniLM-L6-v2", max_length=100)
    metadata_: Optional[dict] = Field(default=None, sa_column=Column("metadata", JSON, nullable=True))

    __table_args__ = (
        Index("idx_document_chunk_source_name", "source_name"),
        Index("idx_document_chunk_source_type", "source_type"),
        Index("idx_document_chunk_embedding_model", "embedding_model"),
    )


class EvalExperiment(UUIDMixin, TimestampMixin, SQLModel, table=True):
    """
    Represents an evaluation experiment.
    """
    __tablename__ = "eval_experiments"

    name: str = Field(nullable=False)
    prompt_version: Optional[str] = Field(default=None)
    description: Optional[str] = Field(default=None)
    params: Optional[dict] = Field(default=None, sa_column=Column(JSON, nullable=True))

    __table_args__ = (
        Index("idx_eval_experiment_name", "name"),
        Index("idx_eval_experiment_prompt_version", "prompt_version"),
    )


class EvalRun(UUIDMixin, TimestampMixin, SQLModel, table=True):
    """
    Represents an evaluation run.

    expected_answer → from golden_dataset (used for RAGAS scoring)
    model_answer    → from overfitting_dataset (used for embedding comparison)
    answer          → what the agent actually responded
    """
    __tablename__ = "eval_runs"

    experiment_id: UUID = Field(foreign_key="eval_experiments.id", nullable=False)
    question: str = Field(nullable=False)
    answer: Optional[str] = Field(default=None)
    expected_answer: Optional[str] = Field(default=None)
    model_answer: Optional[str] = Field(default=None)
    context_used: Optional[dict] = Field(default=None, sa_column=Column(JSON, nullable=True))
    latency_ms: Optional[int] = Field(default=None)

    __table_args__ = (
        Index("idx_eval_run_experiment_id", "experiment_id"),
    )


class EvalResult(UUIDMixin, TimestampMixin, SQLModel, table=True):
    """
    Represents an evaluation result.
    """
    __tablename__ = "eval_results"

    run_id: UUID = Field(foreign_key="eval_runs.id", nullable=False)
    faithfulness: Optional[float] = Field(default=None)
    answer_relevancy: Optional[float] = Field(default=None)
    context_relevancy: Optional[float] = Field(default=None)
    context_recall: Optional[float] = Field(default=None)
    context_precision: Optional[float] = Field(default=None)
    overall_score: Optional[float] = Field(default=None)

    __table_args__ = (
        Index("idx_eval_result_run_id", "run_id"),
    )
