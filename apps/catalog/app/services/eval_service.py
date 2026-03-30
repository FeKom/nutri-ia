import json
import logging
import time
from pathlib import Path
from typing import Any
from uuid import UUID

import httpx
from sqlmodel import Session, select

from app.core.config import settings
from app.models.eval import DocumentChunk, EvalExperiment, EvalResult, EvalRun, SourceType
from app.schemas.eval import (
    EvalExperimentCreate,
    EvalQuestion,
    GoldenDatasetItem,
    IngestResponse,
    OverfittingDatasetItem,
)

logger = logging.getLogger(__name__)

DATASETS_DIR = Path(__file__).resolve().parents[2] / "tests" / "eval" / "datasets"


def _chunk_text(text: str, chunk_size: int = 500, overlap: int = 50) -> list[str]:
    """Split text into overlapping chunks by character count."""
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunks.append(text[start:end].strip())
        start += chunk_size - overlap
    return [c for c in chunks if c]


# ─── Ingestion ────────────────────────────────────────────────────────────────

def ingest_dataset(session: Session, filename: str) -> IngestResponse:
    """
    Chunk a dataset file and store embeddings in document_chunks.

    JSON  → each Q&A pair becomes one chunk (question + answer as text)
    PDF   → text extracted per page, split into 500-char overlapping chunks
    MD    → split by ## headings or into 500-char overlapping chunks
    """
    path = DATASETS_DIR / filename
    if not path.exists():
        raise FileNotFoundError(f"Dataset not found: {path}")

    suffix = path.suffix.lower()
    raw_chunks: list[str] = []
    source_type: SourceType

    if suffix == ".json":
        source_type = SourceType.TEXT
        with open(path, encoding="utf-8") as f:
            items = json.load(f)
        for item in items:
            question = item.get("question", "")
            answer = item.get("expected_answer", "")
            if answer:
                raw_chunks.append(f"Pergunta: {question}\nResposta: {answer}")
            else:
                raw_chunks.append(f"Pergunta: {question}")

    elif suffix == ".pdf":
        source_type = SourceType.PDF
        try:
            import pdfplumber
        except ImportError:
            raise ImportError("Run: pip install pdfplumber")
        with pdfplumber.open(path) as pdf:
            full_text = "\n".join(page.extract_text() or "" for page in pdf.pages)
        raw_chunks = _chunk_text(full_text, chunk_size=500, overlap=50)

    elif suffix == ".md":
        source_type = SourceType.MARKDOWN
        with open(path, encoding="utf-8") as f:
            content = f.read()
        # split by ## headings first; fall back to fixed-size chunks
        sections = [s.strip() for s in content.split("\n## ") if s.strip()]
        for section in sections:
            if len(section) <= 500:
                raw_chunks.append(section)
            else:
                raw_chunks.extend(_chunk_text(section, chunk_size=500, overlap=50))

    else:
        raise ValueError(f"Unsupported file extension: {suffix}")

    # check which chunk_indexes already exist for this source to avoid duplicates
    existing_indexes = set(
        session.exec(
            select(DocumentChunk.chunk_index).where(DocumentChunk.source_name == filename)
        ).all()
    )

    to_create = [
        (idx, text)
        for idx, text in enumerate(raw_chunks)
        if idx not in existing_indexes
    ]

    if not to_create:
        return IngestResponse(
            filename=filename,
            source_type=source_type.value,
            chunks_created=0,
            chunks_skipped=len(raw_chunks),
        )

    texts = [text for _, text in to_create]
    from app.services.embedding_service import generate_embeddings_batch
    embeddings = generate_embeddings_batch(texts)

    for (idx, text), embedding in zip(to_create, embeddings):
        chunk = DocumentChunk(
            content=text,
            embedding=embedding,
            source_name=filename,
            source_type=source_type,
            chunk_index=idx,
            chunk_size=len(text),
            chunk_overlap=50 if suffix != ".json" else 0,
            embedding_model="all-MiniLM-L6-v2",
        )
        session.add(chunk)

    session.commit()
    logger.info(f"Ingested {len(to_create)} chunks from {filename}")

    return IngestResponse(
        filename=filename,
        source_type=source_type.value,
        chunks_created=len(to_create),
        chunks_skipped=len(existing_indexes),
    )


def search_chunks(session: Session, query: str, retrieval_source: str, limit: int = 5) -> list[DocumentChunk]:
    """
    Search document_chunks by semantic similarity filtered by retrieval_source.
    retrieval_source: "json" → TEXT, "pdf" → PDF, "md" → MARKDOWN
    """
    from app.services.embedding_service import generate_embedding
    from sqlalchemy import text as sa_text

    source_map = {
        "json": SourceType.TEXT,
        "pdf": SourceType.PDF,
        "md": SourceType.MARKDOWN,
    }
    source_type = source_map.get(retrieval_source, SourceType.TEXT)

    query_embedding = generate_embedding(query)

    results = session.exec(
        select(DocumentChunk)
        .where(DocumentChunk.source_type == source_type)
        .where(DocumentChunk.embedding.isnot(None))
        .order_by(DocumentChunk.embedding.cosine_distance(query_embedding))
        .limit(limit)
    ).all()

    return list(results)


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

def _call_mastra_eval(prompt: str, question: str, retrieval_source: str, expected_answer: str | None = None, agent_mode: str = "direct") -> dict:
    """
    Call Mastra /eval/run with a custom prompt and question.
    Retries on 429/500 rate-limit errors with exponential backoff.
    """
    payload = {
        "prompt": prompt,
        "question": question,
        "retrieval_source": retrieval_source,
        "agent_mode": agent_mode,
    }
    if expected_answer:
        payload["expected_answer"] = expected_answer

    max_retries = 4
    wait = 20  # seconds — start high since agent uses many tokens per question

    for attempt in range(max_retries):
        start = time.monotonic()
        try:
            with httpx.Client(timeout=180.0) as client:
                response = client.post(f"{settings.MASTRA_URL}/eval/run", json=payload)

            if response.status_code == 429 or (
                response.status_code == 500 and "Too Many Requests" in response.text
            ):
                logger.warning(f"Rate limit hit (attempt {attempt + 1}/{max_retries}), waiting {wait}s...")
                time.sleep(wait)
                wait *= 2  # exponential backoff: 20 → 40 → 80 → 160
                continue

            response.raise_for_status()
            data = response.json()
            latency_ms = int((time.monotonic() - start) * 1000)
            return {
                "answer": data.get("answer", ""),
                "context_used": data.get("context_used"),
                "latency_ms": data.get("latency_ms", latency_ms),
                "scores": data.get("scores"),
            }

        except httpx.HTTPError as e:
            logger.error(f"Mastra eval call failed: {e}")
            return {"answer": f"[Error: {e}]", "context_used": None, "latency_ms": 0, "scores": None}

    logger.error("Max retries exceeded for eval call")
    return {"answer": "[Error: rate limit max retries exceeded]", "context_used": None, "latency_ms": 0, "scores": None}


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
            "agent_mode": data.agent_mode,
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
    agent_mode = params.get("agent_mode", "direct")

    runs: list[EvalRun] = []

    for i, item in enumerate(eval_question.items):
        if i > 0:
            time.sleep(15)  # avoid GitHub Models UserByModelByMinuteTokens limit
        result = _call_mastra_eval(
            prompt=prompt,
            question=item.question,
            retrieval_source=retrieval_source,
            expected_answer=item.expected_answer if isinstance(item, GoldenDatasetItem) else None,
            agent_mode=agent_mode,
        )

        run = EvalRun(
            experiment_id=experiment.id,
            question=item.question,
            answer=result["answer"],
            context_used=result.get("context_used"),
            latency_ms=result.get("latency_ms"),
            expected_answer=item.expected_answer if isinstance(item, GoldenDatasetItem) else None,
            model_answer=result["answer"] if isinstance(item, OverfittingDatasetItem) else None,
            weight=item.weight if item.weight is not None else 1.0,
        )
        session.add(run)
        session.flush()  # get run.id before saving result

        # Auto-save scores returned from Mastra
        scores = result.get("scores")
        if scores:
            eval_result = EvalResult(
                run_id=run.id,
                faithfulness=scores.get("faithfulness"),
                answer_relevancy=scores.get("answer_relevancy"),
                context_relevancy=scores.get("context_relevancy"),
                context_recall=scores.get("context_recall"),
                context_precision=scores.get("context_precision"),
                overall_score=scores.get("overall_score"),
            )
            session.add(eval_result)

        runs.append(run)

    session.commit()
    for run in runs:
        session.refresh(run)

    return runs


def run_eval_auto(session: Session, experiment_id: UUID) -> list[EvalRun]:
    """
    Load dataset from experiment params and run eval automatically.
    No need to pass items from outside — reads dataset_filename from experiment.
    """
    experiment = get_experiment_by_id(session, experiment_id)
    params = experiment.params or {}
    dataset_filename = params.get("dataset_filename", "golden_dataset.json")

    raw_items = load_dataset(dataset_filename)

    # Parse items depending on dataset type
    items = []
    for raw in raw_items:
        if "expected_answer" in raw:
            items.append(GoldenDatasetItem(
                question=raw["question"],
                expected_answer=raw["expected_answer"],
                weight=raw.get("weight", 1.0),
            ))
        else:
            items.append(OverfittingDatasetItem(
                question=raw["question"],
                weight=raw.get("weight", 1.0),
            ))

    from app.schemas.eval import EvalQuestion
    eval_question = EvalQuestion(items=items, experiment_id=experiment_id)
    return run_eval(session, eval_question)


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
