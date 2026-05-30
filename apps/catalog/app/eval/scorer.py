import json
from abc import ABC, abstractmethod
from pathlib import Path


class Scorer(ABC):
    name: str

    @abstractmethod
    def score(
        self,
        question: str,
        answer: str,
        context: list[str],
        expected_answer: str | None = None,
    ) -> float | None: ...


def load_weights(path: Path) -> dict[str, float]:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def compute_weighted_score(
    question: str,
    answer: str,
    context: list[str],
    expected_answer: str | None,
    scorers: list[Scorer],
    weights: dict[str, float],
) -> dict:
    """
    Run all scorers and compute a normalized weighted average.
    Scorers returning None are excluded from the weighted average.
    Weights are normalized to sum to 1.0 over active (non-None) scorers only.
    """
    raw_scores: dict[str, float | None] = {}
    for scorer in scorers:
        raw_scores[scorer.name] = scorer.score(
            question, answer, context, expected_answer
        )

    active = {name: score for name, score in raw_scores.items() if score is not None}

    active_weights = {name: weights.get(name, 1.0) for name in active}
    total = sum(active_weights.values())

    if total == 0 or not active:
        overall = None
    else:
        overall = sum(active[name] * (active_weights[name] / total) for name in active)

    return {**raw_scores, "overall_score": overall}
