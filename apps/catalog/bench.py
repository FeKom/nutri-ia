import time
from sentence_transformers import SentenceTransformer

WORDS = [f"passage: nutrition food item word {i}" for i in range(100)]

for model_name, dims in [("intfloat/multilingual-e5-small", 384), ("intfloat/multilingual-e5-base", 768)]:
    print(f"Loading {model_name}...")
    model = SentenceTransformer(model_name)

    model.encode(WORDS, batch_size=32)  # warmup

    start = time.perf_counter()
    for _ in range(10):
        model.encode(WORDS, batch_size=32, normalize_embeddings=True, device="cpu")
    elapsed = (time.perf_counter() - start) / 10

    print(f"{model_name} ({dims} dims): {elapsed * 1000:.1f}ms for 100 words — {elapsed * 10:.1f}ms/word\n")
