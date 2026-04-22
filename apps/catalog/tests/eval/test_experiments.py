import pytest
from uuid import uuid4
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool

from app.eval.experiments import (
    create_experiment,
    get_experiment_by_id,
    list_experiments,
    create_run,
    list_runs_by_experiment,
    save_result,
    get_result_by_run,
)
from app.models.eval import EvalExperiment, EvalRun, EvalResult


@pytest.fixture(name="session")
def session_fixture():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session


def test_create_and_get_experiment(session):
    exp = create_experiment(
        session,
        name="test-exp",
        description="desc",
        params={"prompt_file": "v1.md", "dataset_filename": "golden_dataset.json"},
    )
    assert exp.id is not None
    fetched = get_experiment_by_id(session, exp.id)
    assert fetched.name == "test-exp"


def test_list_experiments(session):
    create_experiment(session, name="a", params={})
    create_experiment(session, name="b", params={})
    exps = list_experiments(session)
    assert len(exps) == 2


def test_create_and_list_runs(session):
    exp = create_experiment(session, name="exp", params={})
    run = create_run(session, experiment_id=exp.id, question="Q?", answer="A", weight=1.0)
    assert run.id is not None
    runs = list_runs_by_experiment(session, exp.id)
    assert len(runs) == 1
    assert runs[0].question == "Q?"


def test_save_and_get_result(session):
    exp = create_experiment(session, name="exp", params={})
    run = create_run(session, experiment_id=exp.id, question="Q?", answer="A", weight=1.0)
    result = save_result(session, run_id=run.id, faithfulness=0.9, overall_score=0.85)
    assert result.faithfulness == pytest.approx(0.9)
    fetched = get_result_by_run(session, run.id)
    assert fetched is not None
    assert fetched.overall_score == pytest.approx(0.85)


def test_get_experiment_not_found_raises(session):
    with pytest.raises(ValueError, match="not found"):
        get_experiment_by_id(session, uuid4())
