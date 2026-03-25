import json
import logging
import time
from pathlib import Path
from typing import Any
from uuid import UUID

import httpx
from sqlmodel import Session, select

from app.core.config import settings
from app.models.eval import EvalExperiment, EvalResult, EvalRun
from app.schemas.eval import (
    EvalExperimentCreate,
    EvalQuestion,
    GoldenDatasetItem,
    OverfittingDatasetItem,
)

logger = logging.getLogger(__name__)

DATASETS_DIR = Path(__file__).resolve().parents[2] / "tests" / "eval" / "datasets"


# ─── Datasets ─────────────────────────────────────────────────────────────────

def list_datasets() -> list[str]:
    """List all available dataset files in tests/eval/datasets/."""
    if not DATASETS_DIR.exists():
        return []
    return [f.name for f in DATASETS_DIR.iterdir() if f.suffix in (".json", ".pdf", ".md")]


def load_dataset(filename: str) -> Any:
    """
    Load a dataset from tests/eval/datasets/ by filename.

    Supports:
      - .json → returns parsed list
      - .pdf  → returns list of strings (one per page)
      - .md   → returns raw markdown string
    """
    path = DATASETS_DIR / filename

    if not path.exists():
        raise FileNotFoundError(f"Dataset not found: {path}")

    match path.suffix.lower():
        case ".json":
            with open(path, encoding="utf-8") as f:
                return json.load(f)
        case ".pdf":
            try:
                import pdfplumber
            except ImportError:
                raise ImportError("Run: pip install pdfplumber")
            with pdfplumber.open(path) as pdf:
                return [page.extract_text() or "" for page in pdf.pages]
        case ".md":
            with open(path, encoding="utf-8") as f:
                return f.read()
        case _:
            raise ValueError(f"Unsupported file extension: {path.suffix}")


# ─── Mastra ───────────────────────────────────────────────────────────────────

def _call_mastra_eval(prompt: str, question: str, retrieval_source: str) -> dict:
    """
    Call Mastra /eval/run with a custom prompt and question.
    Returns { answer, context_used, latency_ms }.
    """
    start = time.monotonic()
    try:
        with httpx.Client(timeout=60.0) as client:
            response = client.post(
                f"{settings.MASTRA_URL}/eval/run",
                json={
                    "prompt": prompt,
                    "question": question,
                    "retrieval_source": retrieval_source,
                },
            )
            response.raise_for_status()
            data = response.json()
    except httpx.HTTPError as e:
        logger.error(f"Mastra eval call failed: {e}")
        return {"answer": f"[Error: {e}]", "context_used": None, "latency_ms": 0}

    latency_ms = int((time.monotonic() - start) * 1000)
    return {
        "answer": data.get("answer", ""),
        "context_used": data.get("context_used"),
        "latency_ms": latency_ms,
    }


# ─── Experiments ──────────────────────────────────────────────────────────────

def create_eval_experiment(session: Session, data: EvalExperimentCreate) -> EvalExperiment:
    """Create a new evaluation experiment."""
    experiment = EvalExperiment(
        name=data.name,
        description=data.description,
        params={
            "prompt": data.prompt,
            "retrieval_source": data.retrieval_source,
            "dataset_filename": data.dataset_filename,
        },
    )
    session.add(experiment)
    session.commit()
    session.refresh(experiment)
    return experiment


def get_experiment_by_id(session: Session, experiment_id: UUID) -> EvalExperiment:
    """Get a single experiment by ID."""
    experiment = session.get(EvalExperiment, experiment_id)
    if not experiment:
        raise ValueError(f"EvalExperiment {experiment_id} not found")
    return experiment


def list_experiments(session: Session) -> list[EvalExperiment]:
    """List all experiments ordered by most recent."""
    return list(session.exec(
        select(EvalExperiment).order_by(EvalExperiment.created_at.desc())
    ).all())


# ─── Runs ─────────────────────────────────────────────────────────────────────

def run_eval(session: Session, eval_question: EvalQuestion) -> list[EvalRun]:
    """
    Execute all questions against Mastra and persist EvalRuns.

    - GoldenDatasetItem     → saves expected_answer for manual/automated comparison
    - OverfittingDatasetItem → saves model_answer for embedding comparison
    """
    experiment = get_experiment_by_id(session, eval_question.experiment_id)
    params = experiment.params or {}
    prompt = params.get("prompt", "")
    retrieval_source = params.get("retrieval_source", "json")

    runs: list[EvalRun] = []

    for item in eval_question.items:
        result = _call_mastra_eval(
            prompt=prompt,
            question=item.question,
            retrieval_source=retrieval_source,
        )

        run = EvalRun(
            experiment_id=experiment.id,
            question=item.question,
            answer=result["answer"],
            context_used=result.get("context_used"),
            latency_ms=result.get("latency_ms"),
            expected_answer=item.expected_answer if isinstance(item, GoldenDatasetItem) else None,
            model_answer=result["answer"] if isinstance(item, OverfittingDatasetItem) else None,
        )
        session.add(run)
        runs.append(run)

    session.commit()
    for run in runs:
        session.refresh(run)

    return runs


def get_run_by_id(session: Session, run_id: UUID) -> EvalRun:
    """Get a single run by ID."""
    run = session.get(EvalRun, run_id)
    if not run:
        raise ValueError(f"EvalRun {run_id} not found")
    return run


def list_runs_by_experiment(session: Session, experiment_id: UUID) -> list[EvalRun]:
    """List all runs for a given experiment ordered by creation."""
    return list(session.exec(
        select(EvalRun)
        .where(EvalRun.experiment_id == experiment_id)
        .order_by(EvalRun.created_at.asc())
    ).all())


# ─── Results ──────────────────────────────────────────────────────────────────

def save_eval_result(
    session: Session,
    run_id: UUID,
    faithfulness: float | None = None,
    answer_relevancy: float | None = None,
    context_recall: float | None = None,
    context_precision: float | None = None,
    overall_score: float | None = None,
) -> EvalResult:
    """Persist scores for a given run. Scores are written manually or via custom metrics."""
    result = EvalResult(
        run_id=run_id,
        faithfulness=faithfulness,
        answer_relevancy=answer_relevancy,
        context_recall=context_recall,
        context_precision=context_precision,
        overall_score=overall_score,
    )
    session.add(result)
    session.commit()
    session.refresh(result)
    return result


def get_result_by_run(session: Session, run_id: UUID) -> EvalResult | None:
    """Get result for a given run, or None if not scored yet."""
    return session.exec(
        select(EvalResult).where(EvalResult.run_id == run_id)
    ).first()
