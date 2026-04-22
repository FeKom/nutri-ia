import pytest
from app.eval.scorer import Scorer, compute_weighted_score, load_weights


class FixedScorer(Scorer):
    name = "fixed"

    def score(self, question, answer, context, expected_answer=None):
        return 0.8


class NoneScorer(Scorer):
    name = "none_scorer"

    def score(self, question, answer, context, expected_answer=None):
        return None


def test_compute_weighted_score_basic():
    scorers = [FixedScorer()]
    weights = {"fixed": 1.0}
    result = compute_weighted_score("q", "a", [], None, scorers, weights)
    assert result["fixed"] == pytest.approx(0.8)
    assert result["overall_score"] == pytest.approx(0.8)


def test_compute_weighted_score_normalizes():
    class FixedA(Scorer):
        name = "a"
        def score(self, q, a, c, e=None): return 0.6

    class FixedB(Scorer):
        name = "b"
        def score(self, q, a, c, e=None): return 1.0

    scorers = [FixedA(), FixedB()]
    weights = {"a": 3.0, "b": 1.0}  # not normalized — engine must normalize
    result = compute_weighted_score("q", "a", [], None, scorers, weights)
    # 0.6 * 0.75 + 1.0 * 0.25 = 0.45 + 0.25 = 0.70
    assert result["overall_score"] == pytest.approx(0.70)


def test_none_scorer_excluded_from_average():
    class FixedA(Scorer):
        name = "a"
        def score(self, q, a, c, e=None): return 1.0

    scorers = [FixedA(), NoneScorer()]
    weights = {"a": 0.5, "none_scorer": 0.5}
    result = compute_weighted_score("q", "a", [], None, scorers, weights)
    # none_scorer returns None → excluded → only "a" contributes
    assert result["overall_score"] == pytest.approx(1.0)
    assert result["none_scorer"] is None


def test_load_weights_returns_dict(tmp_path):
    import json
    w = {"faithfulness": 0.5, "answer_relevancy": 0.5}
    (tmp_path / "weights.json").write_text(json.dumps(w))
    result = load_weights(tmp_path / "weights.json")
    assert result["faithfulness"] == 0.5
