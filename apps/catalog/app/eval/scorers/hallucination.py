import re
from app.eval.scorer import Scorer
from app.eval.scorers.embedding import _cosine, generate_embeddings_batch

GROUNDED_THRESHOLD = 0.45


def _split_sentences(text: str) -> list[str]:
    parts = re.split(r"(?<=[.!?])\s+", text.strip())
    return [p for p in parts if p]


class HallucinationScorer(Scorer):
    """
    Score = fraction of answer sentences grounded in context.
    High score (near 1.0) = answer is grounded. Low score = hallucination.
    """

    name = "hallucination"

    def score(self, question, answer, context, expected_answer=None):
        if not answer or not answer.strip():
            return None
        if not context:
            return None

        sentences = _split_sentences(answer)
        if not sentences:
            return None

        ctx = "\n\n".join(context)
        texts = [ctx] + sentences
        embs = generate_embeddings_batch(texts)

        ctx_emb = embs[0]
        sent_embs = embs[1:]

        grounded = sum(
            1 for se in sent_embs if _cosine(se, ctx_emb) >= GROUNDED_THRESHOLD
        )
        return grounded / len(sentences)
