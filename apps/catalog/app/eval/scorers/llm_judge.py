import logging
from functools import lru_cache

from openai import OpenAI

from app.core.config import settings
from app.eval.scorer import Scorer

logger = logging.getLogger(__name__)

_GITHUB_MODELS_URL = "https://models.inference.ai.azure.com"
_MODEL = "gpt-4o-mini"
_MAX_CONTEXT_CHARS = 6000


@lru_cache(maxsize=1)
def _client() -> OpenAI:
    return OpenAI(
        base_url=_GITHUB_MODELS_URL,
        api_key=settings.GITHUB_TOKEN,
    )


def _judge(prompt: str) -> float | None:
    if not settings.GITHUB_TOKEN:
        logger.warning("[LLMJudge] GITHUB_TOKEN not set — skipping LLM judge")
        return None
    try:
        resp = _client().chat.completions.create(
            model=_MODEL,
            max_tokens=8,
            temperature=0.0,
            messages=[{"role": "user", "content": prompt}],
        )
        reply = resp.choices[0].message.content.strip().upper()
        if reply.startswith("YES"):
            return 1.0
        if reply.startswith("NO"):
            return 0.0
        try:
            return max(0.0, min(1.0, float(reply)))
        except ValueError:
            logger.warning(f"[LLMJudge] Unexpected reply: {reply!r}")
            return None
    except Exception as exc:
        logger.error(f"[LLMJudge] GitHub Models error: {exc}")
        return None


class LLMFaithfulnessScorer(Scorer):
    """
    Asks GitHub Models (gpt-4o-mini): are all claims in the answer grounded in the context?
    Replaces cosine similarity — embedding overlap ≠ factual entailment.
    """

    name = "faithfulness"

    def score(self, question, answer, context, expected_answer=None):
        if not answer or not context:
            return None
        ctx = "\n\n".join(context)[:_MAX_CONTEXT_CHARS]
        prompt = (
            f"Context:\n{ctx}\n\n"
            f"Answer:\n{answer}\n\n"
            "Is every factual claim in the answer fully supported by the context above? "
            "Reply with only YES or NO."
        )
        return _judge(prompt)


class LLMHallucinationScorer(Scorer):
    """
    Asks GitHub Models (gpt-4o-mini): does the answer fabricate or contradict the context?
    High score (1.0) = no hallucination. Low score (0.0) = hallucination detected.
    Replaces the arbitrary cosine-threshold approach.
    """

    name = "hallucination"

    def score(self, question, answer, context, expected_answer=None):
        if not answer or not context:
            return None
        ctx = "\n\n".join(context)[:_MAX_CONTEXT_CHARS]
        prompt = (
            f"Context:\n{ctx}\n\n"
            f"Answer:\n{answer}\n\n"
            "Does the answer contain factual claims that contradict or are absent from "
            "the context above? Reply with only YES (hallucination present) or NO (answer is grounded)."
        )
        result = _judge(prompt)
        # Invert: YES (hallucination found) → 0.0, NO → 1.0
        return None if result is None else 1.0 - result
