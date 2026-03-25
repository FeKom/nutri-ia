from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

from app.api.dependencies import get_db
from app.schemas.eval import (
    EvalExperimentCreate,
    EvalExperimentResponse,
    EvalExperimentSummary,
    EvalListResponse,
    EvalQuestion,
    EvalRunResponse,
    EvalResultResponse,
)
from app.services import eval_service

router = APIRouter()


# ─── Datasets ─────────────────────────────────────────────────────────────────

@router.get("/datasets", response_model=list[str])
def list_datasets() -> list[str]:
    """List all available dataset files in tests/eval/datasets/."""
    return eval_service.list_datasets()


# ─── Experiments ──────────────────────────────────────────────────────────────

@router.post("/experiments", response_model=EvalExperimentSummary, status_code=status.HTTP_201_CREATED)
def create_experiment(
    data: EvalExperimentCreate,
    db: Session = Depends(get_db),
) -> EvalExperimentSummary:
    """Create a new evaluation experiment."""
    experiment = eval_service.create_eval_experiment(db, data)
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
def list_experiments(db: Session = Depends(get_db)) -> EvalListResponse:
    """List all experiments ordered by most recent."""
    experiments = eval_service.list_experiments(db)
    summaries = []
    for exp in experiments:
        runs = eval_service.list_runs_by_experiment(db, exp.id)
        summaries.append(EvalExperimentSummary(
            id=exp.id,
            name=exp.name,
            description=exp.description,
            params=exp.params,
            created_at=exp.created_at.isoformat(),
            run_count=len(runs),
            avg_scores=None,
        ))
    return EvalListResponse(experiments=summaries, count=len(summaries))


@router.get("/experiments/{experiment_id}", response_model=EvalExperimentResponse)
def get_experiment(
    experiment_id: UUID,
    db: Session = Depends(get_db),
) -> EvalExperimentResponse:
    """Get a single experiment with all its runs and results."""
    try:
        experiment = eval_service.get_experiment_by_id(db, experiment_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

    runs = eval_service.list_runs_by_experiment(db, experiment_id)
    run_responses = []
    for run in runs:
        result = eval_service.get_result_by_run(db, run.id)
        run_responses.append(EvalRunResponse(
            id=run.id,
            question=run.question,
            expected_answer=run.expected_answer,
            model_answer=run.model_answer,
            answer=run.answer,
            latency_ms=run.latency_ms,
            result=EvalResultResponse(
                faithfulness=result.faithfulness,
                answer_relevancy=result.answer_relevancy,
                context_recall=result.context_recall,
                context_precision=result.context_precision,
                overall_score=result.overall_score,
            ) if result else None,
        ))

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
        runs = eval_service.run_eval(db, eval_question)
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


@router.get("/experiments/{experiment_id}/runs", response_model=list[EvalRunResponse])
def list_runs(
    experiment_id: UUID,
    db: Session = Depends(get_db),
) -> list[EvalRunResponse]:
    """List all runs for a given experiment."""
    runs = eval_service.list_runs_by_experiment(db, experiment_id)
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
        run = eval_service.get_run_by_id(db, run_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

    result = eval_service.get_result_by_run(db, run.id)
    return EvalRunResponse(
        id=run.id,
        question=run.question,
        expected_answer=run.expected_answer,
        model_answer=run.model_answer,
        answer=run.answer,
        latency_ms=run.latency_ms,
        result=EvalResultResponse(
            faithfulness=result.faithfulness,
            answer_relevancy=result.answer_relevancy,
            context_recall=result.context_recall,
            context_precision=result.context_precision,
            overall_score=result.overall_score,
        ) if result else None,
    )


# ─── Results ──────────────────────────────────────────────────────────────────

@router.post("/runs/{run_id}/results", response_model=EvalResultResponse, status_code=status.HTTP_201_CREATED)
def save_result(
    run_id: UUID,
    result: EvalResultResponse,
    db: Session = Depends(get_db),
) -> EvalResultResponse:
    """Save scores for a run manually."""
    try:
        eval_service.get_run_by_id(db, run_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

    saved = eval_service.save_eval_result(
        db,
        run_id=run_id,
        faithfulness=result.faithfulness,
        answer_relevancy=result.answer_relevancy,
        context_recall=result.context_recall,
        context_precision=result.context_precision,
        overall_score=result.overall_score,
    )
    return EvalResultResponse(
        faithfulness=saved.faithfulness,
        answer_relevancy=saved.answer_relevancy,
        context_recall=saved.context_recall,
        context_precision=saved.context_precision,
        overall_score=saved.overall_score,
    )
