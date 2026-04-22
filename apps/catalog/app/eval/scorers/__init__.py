from app.eval.scorers.embedding import (
    FaithfulnessScorer,
    AnswerRelevancyScorer,
    ContextRelevancyScorer,
    ContextRecallScorer,
    ContextPrecisionScorer,
)
from app.eval.scorers.hallucination import HallucinationScorer
from app.eval.scorers.jailbreak import JailbreakScorer

ALL_SCORERS = [
    FaithfulnessScorer(),
    AnswerRelevancyScorer(),
    ContextRelevancyScorer(),
    ContextRecallScorer(),
    ContextPrecisionScorer(),
    HallucinationScorer(),
    JailbreakScorer(),
]
