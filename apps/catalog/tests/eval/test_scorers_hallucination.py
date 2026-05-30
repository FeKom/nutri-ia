from unittest.mock import patch
import pytest
from app.eval.scorers.hallucination import HallucinationScorer


def test_fully_grounded_answer():
    scorer = HallucinationScorer()
    with patch("app.eval.scorers.hallucination.generate_embeddings_batch") as mock:
        context_vec = [1.0, 0.0]
        mock.return_value = [context_vec, context_vec, context_vec]
        score = scorer.score("q", "sentence one. sentence two.", ["some context"])
    assert score == pytest.approx(1.0)


def test_fully_hallucinated_answer():
    scorer = HallucinationScorer()
    with patch("app.eval.scorers.hallucination.generate_embeddings_batch") as mock:
        context_vec = [1.0, 0.0]
        orthogonal_vec = [0.0, 1.0]
        mock.return_value = [context_vec, orthogonal_vec, orthogonal_vec]
        score = scorer.score(
            "q", "bad sentence one. bad sentence two.", ["some context"]
        )
    assert score == pytest.approx(0.0)


def test_empty_answer_returns_none():
    scorer = HallucinationScorer()
    assert scorer.score("q", "", ["context"]) is None


def test_no_context_returns_none():
    scorer = HallucinationScorer()
    assert scorer.score("q", "an answer", []) is None
