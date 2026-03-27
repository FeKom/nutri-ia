from typing import List, Optional, Union
from uuid import UUID

from pydantic import BaseModel, Field


class GoldenDatasetItem(BaseModel):
    """
    Entry from golden_dataset.json — fixed, never changes.
    Has expected_answer for full automated scoring.
    weight: optional multiplier for weighted average scoring (default 1.0).
    """
    question: str = Field(..., min_length=1)
    expected_answer: str = Field(..., min_length=1)
    weight: Optional[float] = Field(default=1.0, ge=0.0)


class OverfittingDatasetItem(BaseModel):
    """
    Entry from overfitting datasets — questions the model has never seen.
    model_answer is populated after the run for embedding comparison.
    weight: optional multiplier for weighted average scoring (default 1.0).
    """
    question: str = Field(..., min_length=1)
    model_answer: Optional[str] = None
    weight: Optional[float] = Field(default=1.0, ge=0.0)


DatasetItem = Union[GoldenDatasetItem, OverfittingDatasetItem]


class EvalQuestion(BaseModel):
    """
    Input for eval_runs.

    items         → loaded from dataset_filename (golden or overfitting)
    experiment_id → which experiment these runs belong to
    """
    items: List[DatasetItem] = Field(..., min_length=1)
    experiment_id: UUID


class EvalExperimentCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    prompt: str = Field(..., min_length=1, description="System prompt to test")
    retrieval_source: str = Field(default="json", description="json | pdf | md")
    dataset_filename: str = Field(default="golden_dataset.json", description="Dataset file inside tests/eval/datasets/")
    agent_mode: str = Field(default="direct", description="direct | production | test")

class EvalResultResponse(BaseModel):
    faithfulness: Optional[float] = None
    answer_relevancy: Optional[float] = None
    context_recall: Optional[float] = None
    context_precision: Optional[float] = None
    overall_score: Optional[float] = None


class EvalRunResponse(BaseModel):
    id: UUID
    question: str
    expected_answer: Optional[str]   # golden dataset
    model_answer: Optional[str]       # overfitting dataset
    answer: Optional[str]             # what the agent responded
    latency_ms: Optional[int]
    weight: float = 1.0              # for weighted average scoring
    result: Optional[EvalResultResponse] = None

    class Config:
        from_attributes = True


class IngestResponse(BaseModel):
    filename: str
    source_type: str
    chunks_created: int
    chunks_skipped: int


class EvalExperimentResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str]
    params: Optional[dict]
    created_at: str
    runs: List[EvalRunResponse] = []
    avg_scores: Optional[EvalResultResponse] = None

    class Config:
        from_attributes = True


class EvalExperimentSummary(BaseModel):
    id: UUID
    name: str
    description: Optional[str]
    params: Optional[dict]
    created_at: str
    run_count: int
    avg_scores: Optional[EvalResultResponse] = None

    class Config:
        from_attributes = True


class EvalListResponse(BaseModel):
    experiments: List[EvalExperimentSummary]
    count: int


class ChunkSearchRequest(BaseModel):
    query: str = Field(..., min_length=1)
    retrieval_source: str = Field(default="json", description="json | pdf | md")
    limit: int = Field(default=5, ge=1, le=20)

class ChunkResult(BaseModel):
    content: str
    source_name: str
    chunk_index: int

class ChunkSearchResponse(BaseModel):
    chunks: List[ChunkResult]
    count: int
