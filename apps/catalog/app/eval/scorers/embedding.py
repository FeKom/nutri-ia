from app.eval.scorer import Scorer


def _cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = sum(x * x for x in a) ** 0.5
    norm_b = sum(x * x for x in b) ** 0.5
    return dot / (norm_a * norm_b) if norm_a and norm_b else 0.0


def generate_embeddings_batch(texts: list[str], **kwargs) -> list[list[float]]:
    from app.services.embedding_service import generate_embeddings_batch as _gen
    return _gen(texts, **kwargs)


class FaithfulnessScorer(Scorer):
    name = "faithfulness"

    def score(self, question, answer, context, expected_answer=None):
        ctx = "\n\n".join(context)
        embs = generate_embeddings_batch([answer, ctx])
        return _cosine(embs[0], embs[1])


class AnswerRelevancyScorer(Scorer):
    name = "answer_relevancy"

    def score(self, question, answer, context, expected_answer=None):
        embs = generate_embeddings_batch([question, answer])
        return _cosine(embs[0], embs[1])


class ContextRelevancyScorer(Scorer):
    name = "context_relevancy"

    def score(self, question, answer, context, expected_answer=None):
        ctx = "\n\n".join(context)
        embs = generate_embeddings_batch([question, ctx])
        return _cosine(embs[0], embs[1])


class ContextRecallScorer(Scorer):
    name = "context_recall"

    def score(self, question, answer, context, expected_answer=None):
        if not expected_answer:
            return None
        ctx = "\n\n".join(context)
        embs = generate_embeddings_batch([expected_answer, ctx])
        return _cosine(embs[0], embs[1])


class ContextPrecisionScorer(Scorer):
    name = "context_precision"

    def score(self, question, answer, context, expected_answer=None):
        if not expected_answer or not context:
            return None
        chunk_embs_input = [question] + context
        embs = generate_embeddings_batch(chunk_embs_input)
        q_emb = embs[0]
        chunk_embs = embs[1:]
        return sum(_cosine(q_emb, ce) for ce in chunk_embs) / len(chunk_embs)
