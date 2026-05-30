from uuid import UUID
from sqlmodel import Session, select

from app.models.eval import EvalExperiment, EvalRun, EvalResult


def create_experiment(
    session: Session,
    name: str,
    params: dict,
    description: str | None = None,
) -> EvalExperiment:
    exp = EvalExperiment(name=name, description=description, params=params)
    session.add(exp)
    session.commit()
    session.refresh(exp)
    return exp


def get_experiment_by_id(session: Session, experiment_id: UUID) -> EvalExperiment:
    exp = session.get(EvalExperiment, experiment_id)
    if not exp:
        raise ValueError(f"EvalExperiment {experiment_id} not found")
    return exp


def list_experiments(session: Session) -> list[EvalExperiment]:
    return list(
        session.exec(
            select(EvalExperiment).order_by(EvalExperiment.created_at.desc())
        ).all()
    )


def create_run(
    session: Session,
    experiment_id: UUID,
    question: str,
    answer: str | None,
    weight: float = 1.0,
    expected_answer: str | None = None,
    model_answer: str | None = None,
    context_used: dict | None = None,
    latency_ms: int | None = None,
) -> EvalRun:
    run = EvalRun(
        experiment_id=experiment_id,
        question=question,
        answer=answer,
        expected_answer=expected_answer,
        model_answer=model_answer,
        context_used=context_used,
        latency_ms=latency_ms,
        weight=weight,
    )
    session.add(run)
    session.flush()
    session.refresh(run)
    return run


def get_run_by_id(session: Session, run_id: UUID) -> EvalRun:
    run = session.get(EvalRun, run_id)
    if not run:
        raise ValueError(f"EvalRun {run_id} not found")
    return run


def list_runs_by_experiment(session: Session, experiment_id: UUID) -> list[EvalRun]:
    return list(
        session.exec(
            select(EvalRun)
            .where(EvalRun.experiment_id == experiment_id)
            .order_by(EvalRun.created_at.asc())
        ).all()
    )


def save_result(
    session: Session,
    run_id: UUID,
    faithfulness: float | None = None,
    answer_relevancy: float | None = None,
    context_relevancy: float | None = None,
    context_recall: float | None = None,
    context_precision: float | None = None,
    hallucination: float | None = None,
    jailbreak: float | None = None,
    overall_score: float | None = None,
) -> EvalResult:
    result = EvalResult(
        run_id=run_id,
        faithfulness=faithfulness,
        answer_relevancy=answer_relevancy,
        context_relevancy=context_relevancy,
        context_recall=context_recall,
        context_precision=context_precision,
        hallucination=hallucination,
        jailbreak=jailbreak,
        overall_score=overall_score,
    )
    session.add(result)
    session.commit()
    session.refresh(result)
    return result


def get_result_by_run(session: Session, run_id: UUID) -> EvalResult | None:
    return session.exec(select(EvalResult).where(EvalResult.run_id == run_id)).first()
