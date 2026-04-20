import logging
import time
from pathlib import Path
from uuid import UUID

import httpx
from sqlmodel import Session

from app.core.config import settings
from app.eval.datasets import PROMPTS_DIR, load_dataset
from app.eval.experiments import (
    create_experiment,
    create_run,
    get_experiment_by_id,
    save_result,
)
from app.eval.scorer import compute_weighted_score, load_weights
from app.eval.scorers import ALL_SCORERS
from app.schemas.eval import EvalExperimentCreate

logger = logging.getLogger(__name__)

WEIGHTS_PATH = Path(__file__).resolve().parents[2] / "tests" / "eval" / "weights.json"


def _resolve_prompt(params: dict) -> str:
    prompt_file = params.get("prompt_file")
    if prompt_file:
        path = PROMPTS_DIR / prompt_file
        if path.exists():
            with open(path, encoding="utf-8") as f:
                return f.read()
    return params.get("prompt", "")


def _merge_weights(global_weights: dict, experiment_override: dict | None) -> dict:
    if not experiment_override:
        return global_weights
    return {**global_weights, **experiment_override}


def _call_mastra(
    prompt: str,
    question: str,
    retrieval_source: str,
    expected_answer: str | None = None,
    agent_mode: str = "direct",
) -> dict:
    payload = {
        "prompt": prompt,
        "question": question,
        "retrieval_source": retrieval_source,
        "agent_mode": agent_mode,
    }
    if expected_answer:
        payload["expected_answer"] = expected_answer

    max_retries = 4
    wait = 20

    for attempt in range(max_retries):
        start = time.monotonic()
        try:
            with httpx.Client(timeout=180.0) as client:
                response = client.post(f"{settings.MASTRA_URL}/eval/run", json=payload)

            if response.status_code == 429 or (
                response.status_code == 500 and "Too Many Requests" in response.text
            ):
                logger.warning(f"Rate limit (attempt {attempt + 1}/{max_retries}), waiting {wait}s...")
                time.sleep(wait)
                wait *= 2
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

    logger.error("Max retries exceeded")
    return {"answer": "[Error: max retries]", "context_used": None, "latency_ms": 0, "scores": None}


def run_experiment(session: Session, experiment_id: UUID) -> list:
    """Full eval flow: load dataset → call Mastra → score → save."""
    experiment = get_experiment_by_id(session, experiment_id)
    params = experiment.params or {}

    prompt = _resolve_prompt(params)
    retrieval_source = params.get("retrieval_source", "json")
    agent_mode = params.get("agent_mode", "direct")
    dataset_filename = params.get("dataset_filename", "golden_dataset.json")

    global_weights = load_weights(WEIGHTS_PATH)
    weights = _merge_weights(global_weights, params.get("weights"))

    raw_items = load_dataset(dataset_filename)
    runs = []

    for i, raw in enumerate(raw_items):
        if i > 0:
            time.sleep(15)

        is_golden = "expected_answer" in raw
        expected_answer = raw.get("expected_answer") if is_golden else None
        question = raw["question"]
        weight = raw.get("weight", 1.0)

        result = _call_mastra(
            prompt=prompt,
            question=question,
            retrieval_source=retrieval_source,
            expected_answer=expected_answer,
            agent_mode=agent_mode,
        )

        run = create_run(
            session,
            experiment_id=experiment_id,
            question=question,
            answer=result["answer"],
            expected_answer=expected_answer,
            model_answer=result["answer"] if not is_golden else None,
            context_used=result.get("context_used"),
            latency_ms=result.get("latency_ms"),
            weight=weight,
        )

        context_chunks = []
        if isinstance(result.get("context_used"), dict):
            context_chunks = list(result["context_used"].values())
        elif isinstance(result.get("context_used"), list):
            context_chunks = result["context_used"]

        scores = compute_weighted_score(
            question=question,
            answer=result["answer"] or "",
            context=context_chunks,
            expected_answer=expected_answer,
            scorers=ALL_SCORERS,
            weights=weights,
        )

        save_result(
            session,
            run_id=run.id,
            faithfulness=scores.get("faithfulness"),
            answer_relevancy=scores.get("answer_relevancy"),
            context_relevancy=scores.get("context_relevancy"),
            context_recall=scores.get("context_recall"),
            context_precision=scores.get("context_precision"),
            hallucination=scores.get("hallucination"),
            jailbreak=scores.get("jailbreak"),
            overall_score=scores.get("overall_score"),
        )

        runs.append(run)

    session.commit()
    return runs


def create_eval_experiment(session: Session, data: EvalExperimentCreate):
    params = {
        "prompt": data.prompt,
        "retrieval_source": data.retrieval_source,
        "dataset_filename": data.dataset_filename,
        "agent_mode": data.agent_mode,
    }
    return create_experiment(session, name=data.name, description=data.description, params=params)
