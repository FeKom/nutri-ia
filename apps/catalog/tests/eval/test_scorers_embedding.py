from unittest.mock import patch
import pytest
from app.eval.scorers.embedding import (
    FaithfulnessScorer,
    AnswerRelevancyScorer,
    ContextRelevancyScorer,
    ContextRecallScorer,
    ContextPrecisionScorer,
)

VEC_Q = [1.0, 0.0, 0.0]
VEC_A = [1.0, 0.0, 0.0]
VEC_C = [0.0, 1.0, 0.0]
VEC_E = [1.0, 0.0, 0.0]


def _mock_batch(texts, **kwargs):
    mapping = {
        "question": VEC_Q,
        "answer": VEC_A,
        "context": VEC_C,
        "expected": VEC_E,
    }
    result = []
    for t in texts:
        for key, vec in mapping.items():
            if key in t.lower():
                result.append(vec)
                break
        else:
            result.append([0.0, 0.0, 1.0])
    return result


@patch("app.eval.scorers.embedding.generate_embeddings_batch", side_effect=_mock_batch)
def test_faithfulness_scorer(mock_emb):
    scorer = FaithfulnessScorer()
    score = scorer.score("question", "answer", ["context chunk"])
    assert score is not None
    assert 0.0 <= score <= 1.0


@patch("app.eval.scorers.embedding.generate_embeddings_batch", side_effect=_mock_batch)
def test_answer_relevancy_scorer(mock_emb):
    scorer = AnswerRelevancyScorer()
    score = scorer.score("question", "answer", ["context chunk"])
    assert score is not None


@patch("app.eval.scorers.embedding.generate_embeddings_batch", side_effect=_mock_batch)
def test_context_recall_requires_expected(mock_emb):
    scorer = ContextRecallScorer()
    assert scorer.score("question", "answer", ["context"], expected_answer=None) is None
    score = scorer.score("question", "answer", ["context"], expected_answer="expected answer")
    assert score is not None
