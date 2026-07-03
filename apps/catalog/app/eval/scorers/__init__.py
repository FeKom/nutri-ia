from app.eval.scorers.embedding import (
    AnswerRelevancyScorer,
    ContextPrecisionScorer,
    ContextRecallScorer,
    ContextRelevancyScorer,
)
from app.eval.scorers.jailbreak import JailbreakScorer
from app.eval.scorers.llm_judge import LLMFaithfulnessScorer, LLMHallucinationScorer

ALL_SCORERS = [
    LLMFaithfulnessScorer(),      # LLM-as-judge: factual entailment check
    LLMHallucinationScorer(),     # LLM-as-judge: fabrication detection
    AnswerRelevancyScorer(),      # cosine: question vs answer topic match
    ContextRelevancyScorer(),     # cosine: question vs retrieved context
    ContextRecallScorer(),        # cosine: expected answer coverage in context
    ContextPrecisionScorer(),     # cosine: avg chunk relevance to question
    JailbreakScorer(),            # cosine: adversarial pattern detection
]
