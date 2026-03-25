from typing import List, Optional, Union
from uuid import UUID

from pydantic import BaseModel, Field


class GoldenDatasetItem(BaseModel):
    """
    Entry from golden_dataset.json — fixed, never changes.
    Has expected_answer for full automated scoring.
    """
    question: str = Field(..., min_length=1)
    expected_answer: str = Field(..., min_length=1)


class OverfittingDatasetItem(BaseModel):
    """
    Entry from overfitting datasets — questions the model has never seen.
    model_answer is populated after the run for embedding comparison.
    """
    question: str = Field(..., min_length=1)
    model_answer: Optional[str] = None


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

class EvalResultResponse(BaseModel):
    faithfulness: Optional[float] = None
    answer_relevancy: Optional[float] = None
    context_recall: Optional[float] = None
    context_precision: Optional[float] = None
    overall_score: Optional[float] = None


class EvalRunResponse(BaseModel):
    id: UUID
    question: str
    expected_answer: Optional[str]   # golden dataset — for RAGAS scoring
    model_answer: Optional[str]       # overfitting dataset — for embedding comparison
    answer: Optional[str]             # what the agent responded
    latency_ms: Optional[int]
    result: Optional[EvalResultResponse] = None

    class Config:
        from_attributes = True


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
