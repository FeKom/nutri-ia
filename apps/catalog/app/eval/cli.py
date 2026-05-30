"""
Nutria Eval CLI
Usage: python3 -m app.eval.cli <command> [options]
"""

import json
import sys
from pathlib import Path
from uuid import UUID

import typer
from rich.console import Console
from rich.table import Table

app = typer.Typer(help="Nutria eval framework CLI", no_args_is_help=True)
experiment_app = typer.Typer(help="Manage experiments", no_args_is_help=True)
dataset_app = typer.Typer(help="Manage datasets", no_args_is_help=True)
prompt_app = typer.Typer(help="Manage prompts", no_args_is_help=True)

app.add_typer(experiment_app, name="experiment")
app.add_typer(dataset_app, name="dataset")
app.add_typer(prompt_app, name="prompt")

console = Console()


def _get_session():
    from app.database.database import engine
    from sqlmodel import Session

    return Session(engine)


# ─── Experiment commands ───────────────────────────────────────────────────────


@experiment_app.command("create")
def experiment_create(
    name: str = typer.Option(..., help="Experiment name"),
    prompt: str = typer.Option(
        ..., help="Prompt filename (e.g. v1.md) or inline prompt text"
    ),
    dataset: str = typer.Option("golden_dataset.json", help="Dataset filename"),
    retrieval_source: str = typer.Option("json", help="json | pdf | md"),
    agent_mode: str = typer.Option("direct", help="direct | production"),
    description: str = typer.Option(None, help="Optional description"),
):
    """Create a new experiment."""
    from app.eval.experiments import create_experiment

    params = {
        "prompt_file": prompt if prompt.endswith(".md") else None,
        "prompt": prompt if not prompt.endswith(".md") else None,
        "dataset_filename": dataset,
        "retrieval_source": retrieval_source,
        "agent_mode": agent_mode,
    }
    with _get_session() as session:
        exp = create_experiment(
            session, name=name, description=description, params=params
        )
    console.print(f"[green]Created experiment:[/green] {exp.id}")
    console.print(f"  name: {exp.name}")
    console.print(f"  dataset: {dataset}")
    console.print(f"  prompt: {prompt}")


@experiment_app.command("run")
def experiment_run(
    experiment_id: str = typer.Argument(..., help="Experiment UUID"),
):
    """Run all dataset questions against Mastra and score them."""
    from app.eval.runner import run_experiment
    from app.eval.experiments import get_result_by_run

    with _get_session() as session:
        console.print(f"[yellow]Running experiment {experiment_id}...[/yellow]")
        runs = run_experiment(session, UUID(experiment_id))

        table = Table(title="Run Results")
        table.add_column("Question", max_width=50)
        table.add_column("Overall", justify="right")
        table.add_column("Faithfulness", justify="right")
        table.add_column("Jailbreak", justify="right")
        table.add_column("Hallucination", justify="right")

        for run in runs:
            result = get_result_by_run(session, run.id)
            table.add_row(
                run.question[:50],
                f"{result.overall_score:.3f}"
                if result and result.overall_score
                else "—",
                f"{result.faithfulness:.3f}" if result and result.faithfulness else "—",
                f"{result.jailbreak:.3f}" if result and result.jailbreak else "—",
                f"{result.hallucination:.3f}"
                if result and result.hallucination
                else "—",
            )
        console.print(table)
        console.print(f"[green]Done. {len(runs)} runs.[/green]")


@experiment_app.command("list")
def experiment_list():
    """List all experiments with average scores."""
    from app.eval.experiments import (
        list_experiments,
        list_runs_by_experiment,
        get_result_by_run,
    )
    import statistics

    with _get_session() as session:
        experiments = list_experiments(session)
        table = Table(title="Experiments")
        table.add_column("ID", max_width=8)
        table.add_column("Name")
        table.add_column("Runs", justify="right")
        table.add_column("Avg Overall", justify="right")
        table.add_column("Created")

        for exp in experiments:
            runs = list_runs_by_experiment(session, exp.id)
            scores = [
                r.overall_score
                for run in runs
                for r in [get_result_by_run(session, run.id)]
                if r and r.overall_score is not None
            ]
            avg = f"{statistics.mean(scores):.3f}" if scores else "—"
            table.add_row(
                str(exp.id)[:8],
                exp.name,
                str(len(runs)),
                avg,
                str(exp.created_at)[:10],
            )
        console.print(table)


@experiment_app.command("show")
def experiment_show(
    experiment_id: str = typer.Argument(..., help="Experiment UUID"),
):
    """Show per-question scores for an experiment."""
    from app.eval.experiments import (
        get_experiment_by_id,
        list_runs_by_experiment,
        get_result_by_run,
    )

    with _get_session() as session:
        exp = get_experiment_by_id(session, UUID(experiment_id))
        runs = list_runs_by_experiment(session, exp.id)

        table = Table(title=f"{exp.name}")
        table.add_column("Question", max_width=45)
        table.add_column("Overall", justify="right")
        table.add_column("Faith.", justify="right")
        table.add_column("Ans.Rel.", justify="right")
        table.add_column("Halluc.", justify="right")
        table.add_column("Jailbrk", justify="right")

        for run in runs:
            r = get_result_by_run(session, run.id)

            def fmt(v):
                return f"{v:.3f}" if v is not None else "—"

            table.add_row(
                run.question[:45],
                fmt(r.overall_score if r else None),
                fmt(r.faithfulness if r else None),
                fmt(r.answer_relevancy if r else None),
                fmt(r.hallucination if r else None),
                fmt(r.jailbreak if r else None),
            )
        console.print(table)


@experiment_app.command("export")
def experiment_export(
    out: Path = typer.Option(
        "tests/eval/analysis/results.json", help="Output file path"
    ),
):
    """Export all experiment results to a JSON file for the notebook."""
    from app.eval.experiments import (
        list_experiments,
        list_runs_by_experiment,
        get_result_by_run,
    )

    with _get_session() as session:
        experiments = list_experiments(session)
        output = []
        for exp in experiments:
            runs = list_runs_by_experiment(session, exp.id)
            run_data = []
            for run in runs:
                result = get_result_by_run(session, run.id)
                run_data.append(
                    {
                        "id": str(run.id),
                        "question": run.question,
                        "answer": run.answer,
                        "expected_answer": run.expected_answer,
                        "latency_ms": run.latency_ms,
                        "weight": run.weight,
                        "result": {
                            "faithfulness": result.faithfulness,
                            "answer_relevancy": result.answer_relevancy,
                            "context_relevancy": result.context_relevancy,
                            "context_recall": result.context_recall,
                            "context_precision": result.context_precision,
                            "hallucination": result.hallucination,
                            "jailbreak": result.jailbreak,
                            "overall_score": result.overall_score,
                        }
                        if result
                        else None,
                    }
                )
            output.append(
                {
                    "id": str(exp.id),
                    "name": exp.name,
                    "description": exp.description,
                    "params": exp.params,
                    "created_at": str(exp.created_at),
                    "runs": run_data,
                }
            )

    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(output, indent=2, ensure_ascii=False))
    console.print(f"[green]Exported {len(output)} experiments to {out}[/green]")


# ─── Dataset commands ──────────────────────────────────────────────────────────


@dataset_app.command("list")
def dataset_list():
    """List available dataset files."""
    from app.eval.datasets import list_datasets

    datasets = list_datasets()
    if not datasets:
        console.print("[yellow]No datasets found.[/yellow]")
        return
    for name in datasets:
        console.print(f"  {name}")


@dataset_app.command("new")
def dataset_new(
    out: str = typer.Option(..., help="Output filename (e.g. golden_dataset.json)"),
):
    """Interactively build a Q&A dataset file."""
    from app.eval.datasets import DATASETS_DIR

    items = []
    console.print("[bold]Add Q&A pairs. Empty question to finish.[/bold]")
    while True:
        question = typer.prompt("Question", default="").strip()
        if not question:
            break
        expected = typer.prompt("Expected answer").strip()
        weight = typer.prompt("Weight", default="1.0")
        items.append(
            {"question": question, "expected_answer": expected, "weight": float(weight)}
        )
    path = DATASETS_DIR / out
    path.write_text(json.dumps(items, indent=2, ensure_ascii=False))
    console.print(f"[green]Saved {len(items)} items to {path}[/green]")


@dataset_app.command("ingest")
def dataset_ingest(filename: str = typer.Argument(...)):
    """Embed and store a dataset file in document_chunks."""
    from app.eval.datasets import ingest_dataset

    with _get_session() as session:
        result = ingest_dataset(session, filename)
    console.print(
        f"[green]Ingested:[/green] {result.chunks_created} chunks (skipped {result.chunks_skipped})"
    )


# ─── Prompt commands ───────────────────────────────────────────────────────────


@prompt_app.command("list")
def prompt_list():
    """List available prompt files."""
    from app.eval.datasets import list_prompts

    prompts = list_prompts()
    if not prompts:
        console.print("[yellow]No prompts found.[/yellow]")
        return
    for name in prompts:
        console.print(f"  {name}")


@prompt_app.command("new")
def prompt_new(name: str = typer.Option(..., help="Prompt name without .md extension")):
    """Create a new prompt file from the default template."""
    from app.eval.datasets import PROMPTS_DIR

    PROMPTS_DIR.mkdir(parents=True, exist_ok=True)
    path = PROMPTS_DIR / f"{name}.md"
    if path.exists():
        console.print(f"[red]Already exists: {path}[/red]")
        raise typer.Exit(1)
    template = (
        "You are Nutria, a nutrition assistant. Answer questions about food, nutrition, and healthy eating.\n\n"
        "Use the provided context to answer the user's question accurately.\n"
        "If the context does not contain enough information, say so clearly.\n"
        "Always respond in Portuguese (Brazilian).\n"
        "Be concise and helpful.\n"
    )
    path.write_text(template)
    console.print(f"[green]Created: {path}[/green]")


# ─── Score command ─────────────────────────────────────────────────────────────


@app.command("score")
def score_one(
    question: str = typer.Option(...),
    answer: str = typer.Option(...),
    context: str = typer.Option("", help="Comma-separated context chunks"),
    expected: str = typer.Option(None, help="Expected answer"),
):
    """Score a single question/answer pair."""
    from app.eval.scorer import compute_weighted_score, load_weights
    from app.eval.scorers import ALL_SCORERS
    from app.eval.runner import WEIGHTS_PATH

    weights = load_weights(WEIGHTS_PATH)
    context_chunks = [c.strip() for c in context.split(",")] if context else []
    scores = compute_weighted_score(
        question, answer, context_chunks, expected, ALL_SCORERS, weights
    )

    table = Table(title="Scores")
    table.add_column("Metric")
    table.add_column("Score", justify="right")
    for k, v in scores.items():
        table.add_row(k, f"{v:.3f}" if v is not None else "—")
    console.print(table)


if __name__ == "__main__":
    app()
