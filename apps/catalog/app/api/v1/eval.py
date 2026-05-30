from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session

from app.api.dependencies import get_current_user, get_db
from app.eval.datasets import (
    list_datasets,
    ingest_dataset,
    search_chunks,
)
from app.eval.experiments import (
    create_experiment,
    get_experiment_by_id,
    list_experiments,
    create_run,
    get_run_by_id,
    list_runs_by_experiment,
    save_result,
    get_result_by_run,
)
from app.eval.runner import (
    create_eval_experiment,
    run_experiment,
    run_eval_compat,
    score_eval_compat,
)
from app.schemas.eval import (
    ChunkResult,
    ChunkSearchRequest,
    ChunkSearchResponse,
    EvalExperimentCreate,
    EvalExperimentResponse,
    EvalExperimentSummary,
    EvalListResponse,
    EvalQuestion,
    EvalResultResponse,
    EvalRunResponse,
    IngestResponse,
    ScoreRequest,
)

router = APIRouter()


# ─── Datasets ─────────────────────────────────────────────────────────────────


@router.get("/datasets", response_model=list[str])
def list_datasets_route() -> list[str]:
    """List all available dataset files in tests/eval/datasets/."""
    return list_datasets()


@router.post(
    "/datasets/{filename}/ingest",
    response_model=IngestResponse,
    status_code=status.HTTP_201_CREATED,
)
def ingest_dataset_route(
    filename: str,
    db: Session = Depends(get_db),
) -> IngestResponse:
    """
    Chunk a dataset file and store embeddings in document_chunks.
    Skips chunks that already exist (idempotent).
    Supports .json, .pdf and .md files.
    """
    try:
        return ingest_dataset(db, filename)
    except FileNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except (ValueError, ImportError) as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/embed", response_model=list[list[float]])
def embed_texts(texts: list[str]) -> list[list[float]]:
    """Embed a list of texts using the embedding model. Returns a list of vectors."""
    from app.services.embedding_service import generate_embeddings_batch

    return generate_embeddings_batch(texts)


class EmbeddingRequest(BaseModel):
    input: list[str]
    model: str = "intfloat/multilingual-e5-base"


@router.post("/embeddings")
def openai_embeddings(request: EmbeddingRequest) -> dict:
    """
    OpenAI-compatible embeddings endpoint for Mastra ModelRouterEmbeddingModel.
    Accepts {input: string[], model: string} and returns OpenAI embedding format.
    """
    from app.services.embedding_service import generate_embeddings_batch

    vectors = generate_embeddings_batch(request.input)
    return {
        "object": "list",
        "data": [
            {"object": "embedding", "index": i, "embedding": vec}
            for i, vec in enumerate(vectors)
        ],
        "model": request.model,
        "usage": {"prompt_tokens": 0, "total_tokens": 0},
    }


@router.post("/chunks/search", response_model=ChunkSearchResponse)
def search_chunks_route(
    request: ChunkSearchRequest,
    db: Session = Depends(get_db),
) -> ChunkSearchResponse:
    """Search document_chunks by semantic similarity."""
    try:
        chunks = search_chunks(
            db, request.query, request.retrieval_source, request.limit
        )
        return ChunkSearchResponse(
            chunks=[
                ChunkResult(
                    content=c.content,
                    source_name=c.source_name,
                    chunk_index=c.chunk_index,
                )
                for c in chunks
            ],
            count=len(chunks),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e)
        )


# ─── Scoring ──────────────────────────────────────────────────────────────────


@router.post("/score", response_model=EvalResultResponse)
def score(request: ScoreRequest) -> EvalResultResponse:
    """
    Compute embedding-similarity scores for a question/answer/context triple.
    Called by Mastra after each eval run — no DB writes, pure calculation.
    """
    scores = score_eval_compat(
        question=request.question,
        answer=request.answer,
        context_chunks=request.context_chunks,
        expected_answer=request.expected_answer,
    )
    return EvalResultResponse(**scores)


# ─── Experiments ──────────────────────────────────────────────────────────────


@router.post(
    "/experiments",
    response_model=EvalExperimentSummary,
    status_code=status.HTTP_201_CREATED,
)
def create_experiment_route(
    data: EvalExperimentCreate,
    db: Session = Depends(get_db),
    _user: dict = Depends(get_current_user),
) -> EvalExperimentSummary:
    """Create a new evaluation experiment."""
    experiment = create_eval_experiment(db, data)
    return EvalExperimentSummary(
        id=experiment.id,
        name=experiment.name,
        description=experiment.description,
        params=experiment.params,
        created_at=experiment.created_at.isoformat(),
        run_count=0,
        avg_scores=None,
    )


@router.get("/experiments", response_model=EvalListResponse)
def list_experiments_route(db: Session = Depends(get_db)) -> EvalListResponse:
    """List all experiments ordered by most recent."""
    experiments = list_experiments(db)
    summaries = []
    for exp in experiments:
        runs = list_runs_by_experiment(db, exp.id)
        summaries.append(
            EvalExperimentSummary(
                id=exp.id,
                name=exp.name,
                description=exp.description,
                params=exp.params,
                created_at=exp.created_at.isoformat(),
                run_count=len(runs),
                avg_scores=None,
            )
        )
    return EvalListResponse(experiments=summaries, count=len(summaries))


@router.get("/experiments/{experiment_id}", response_model=EvalExperimentResponse)
def get_experiment_route(
    experiment_id: UUID,
    db: Session = Depends(get_db),
) -> EvalExperimentResponse:
    """Get a single experiment with all its runs and results."""
    try:
        experiment = get_experiment_by_id(db, experiment_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

    runs = list_runs_by_experiment(db, experiment_id)
    run_responses = []
    for run in runs:
        result = get_result_by_run(db, run.id)
        run_responses.append(
            EvalRunResponse(
                id=run.id,
                question=run.question,
                expected_answer=run.expected_answer,
                model_answer=run.model_answer,
                answer=run.answer,
                latency_ms=run.latency_ms,
                result=(
                    EvalResultResponse(
                        faithfulness=result.faithfulness,
                        answer_relevancy=result.answer_relevancy,
                        context_relevancy=result.context_relevancy,
                        context_recall=result.context_recall,
                        context_precision=result.context_precision,
                        overall_score=result.overall_score,
                    )
                    if result
                    else None
                ),
            )
        )

    return EvalExperimentResponse(
        id=experiment.id,
        name=experiment.name,
        description=experiment.description,
        params=experiment.params,
        created_at=experiment.created_at.isoformat(),
        runs=run_responses,
        avg_scores=None,
    )


# ─── Runs ─────────────────────────────────────────────────────────────────────


@router.post("/experiments/{experiment_id}/runs", response_model=list[EvalRunResponse])
def run_eval(
    experiment_id: UUID,
    eval_question: EvalQuestion,
    db: Session = Depends(get_db),
) -> list[EvalRunResponse]:
    """Execute all questions against Mastra and persist the runs."""
    try:
        runs = run_eval_compat(db, eval_question)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

    return [
        EvalRunResponse(
            id=run.id,
            question=run.question,
            expected_answer=run.expected_answer,
            model_answer=run.model_answer,
            answer=run.answer,
            latency_ms=run.latency_ms,
            result=None,
        )
        for run in runs
    ]


@router.post(
    "/experiments/{experiment_id}/run",
    response_model=list[EvalRunResponse],
    status_code=status.HTTP_201_CREATED,
)
def run_eval_auto(
    experiment_id: UUID,
    db: Session = Depends(get_db),
    _user: dict = Depends(get_current_user),
) -> list[EvalRunResponse]:
    """
    Auto-load dataset from experiment params and run eval.
    No request body needed — reads dataset from experiment config.
    """
    try:
        runs = run_experiment(db, experiment_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e)
        )

    result_list = []
    for run in runs:
        result = get_result_by_run(db, run.id)
        result_list.append(
            EvalRunResponse(
                id=run.id,
                question=run.question,
                expected_answer=run.expected_answer,
                model_answer=run.model_answer,
                answer=run.answer,
                latency_ms=run.latency_ms,
                weight=run.weight,
                result=(
                    EvalResultResponse(
                        faithfulness=result.faithfulness,
                        answer_relevancy=result.answer_relevancy,
                        context_relevancy=result.context_relevancy,
                        context_recall=result.context_recall,
                        context_precision=result.context_precision,
                        overall_score=result.overall_score,
                    )
                    if result
                    else None
                ),
            )
        )
    return result_list


@router.get("/experiments/{experiment_id}/runs", response_model=list[EvalRunResponse])
def list_runs(
    experiment_id: UUID,
    db: Session = Depends(get_db),
) -> list[EvalRunResponse]:
    """List all runs for a given experiment."""
    runs = list_runs_by_experiment(db, experiment_id)
    return [
        EvalRunResponse(
            id=run.id,
            question=run.question,
            expected_answer=run.expected_answer,
            model_answer=run.model_answer,
            answer=run.answer,
            latency_ms=run.latency_ms,
            result=None,
        )
        for run in runs
    ]


@router.get("/runs/{run_id}", response_model=EvalRunResponse)
def get_run(
    run_id: UUID,
    db: Session = Depends(get_db),
) -> EvalRunResponse:
    """Get a single run by ID."""
    try:
        run = get_run_by_id(db, run_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

    result = get_result_by_run(db, run.id)
    return EvalRunResponse(
        id=run.id,
        question=run.question,
        expected_answer=run.expected_answer,
        model_answer=run.model_answer,
        answer=run.answer,
        latency_ms=run.latency_ms,
        result=(
            EvalResultResponse(
                faithfulness=result.faithfulness,
                answer_relevancy=result.answer_relevancy,
                context_recall=result.context_recall,
                context_precision=result.context_precision,
                overall_score=result.overall_score,
            )
            if result
            else None
        ),
    )


# ─── Results ──────────────────────────────────────────────────────────────────


@router.post(
    "/runs/{run_id}/results",
    response_model=EvalResultResponse,
    status_code=status.HTTP_201_CREATED,
)
def save_result_route(
    run_id: UUID,
    result: EvalResultResponse,
    db: Session = Depends(get_db),
) -> EvalResultResponse:
    """Save scores for a run manually."""
    try:
        get_run_by_id(db, run_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

    saved = save_result(
        db,
        run_id=run_id,
        faithfulness=result.faithfulness,
        answer_relevancy=result.answer_relevancy,
        context_relevancy=result.context_relevancy,
        context_recall=result.context_recall,
        context_precision=result.context_precision,
        overall_score=result.overall_score,
    )
    return EvalResultResponse(
        faithfulness=saved.faithfulness,
        answer_relevancy=saved.answer_relevancy,
        context_relevancy=saved.context_relevancy,
        context_recall=saved.context_recall,
        context_precision=saved.context_precision,
        overall_score=saved.overall_score,
    )
