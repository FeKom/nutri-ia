import json
import logging
from pathlib import Path
from typing import Any

from sqlmodel import Session, select

from app.models.eval import DocumentChunk, SourceType
from app.schemas.eval import IngestResponse

DATASETS_DIR = Path(__file__).resolve().parents[2] / "tests" / "eval" / "datasets"
PROMPTS_DIR = Path(__file__).resolve().parents[2] / "tests" / "eval" / "prompts"

logger = logging.getLogger(__name__)


def list_datasets() -> list[str]:
    if not DATASETS_DIR.exists():
        return []
    return [f.name for f in DATASETS_DIR.iterdir() if f.suffix in (".json", ".pdf", ".md")]


def load_dataset(path_or_name: str) -> Any:
    """
    Load a dataset by filename (relative to DATASETS_DIR) or absolute path.
    Returns parsed list for JSON, list of page strings for PDF, raw string for MD.
    """
    path = Path(path_or_name)
    if not path.is_absolute():
        path = DATASETS_DIR / path_or_name

    if not path.exists():
        raise FileNotFoundError(f"Dataset not found: {path}")

    match path.suffix.lower():
        case ".json":
            with open(path, encoding="utf-8") as f:
                return json.load(f)
        case ".pdf":
            try:
                import pdfplumber
            except ImportError:
                raise ImportError("Run: pip install pdfplumber")
            with pdfplumber.open(path) as pdf:
                return [page.extract_text() or "" for page in pdf.pages]
        case ".md":
            with open(path, encoding="utf-8") as f:
                return f.read()
        case _:
            raise ValueError(f"Unsupported file extension: {path.suffix}")


def list_prompts() -> list[str]:
    if not PROMPTS_DIR.exists():
        return []
    return [f.name for f in PROMPTS_DIR.iterdir() if f.suffix == ".md"]


def load_prompt(filename: str) -> str:
    path = PROMPTS_DIR / filename
    if not path.exists():
        raise FileNotFoundError(f"Prompt not found: {path}")
    with open(path, encoding="utf-8") as f:
        return f.read()


# ─── Ingestion ────────────────────────────────────────────────────────────────


def _chunk_text(text: str, chunk_size: int = 500, overlap: int = 50) -> list[str]:
    """Split text into overlapping chunks by character count."""
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunks.append(text[start:end].strip())
        start += chunk_size - overlap
    return [c for c in chunks if c]


def ingest_dataset(session: Session, filename: str) -> IngestResponse:
    """
    Chunk a dataset file and store embeddings in document_chunks.

    JSON  → each Q&A pair becomes one chunk (question + answer as text)
    PDF   → text extracted per page, split into 500-char overlapping chunks
    MD    → split by ## headings or into 500-char overlapping chunks
    """
    path = DATASETS_DIR / filename
    if not path.exists():
        raise FileNotFoundError(f"Dataset not found: {path}")

    suffix = path.suffix.lower()
    raw_chunks: list[str] = []
    source_type: SourceType

    if suffix == ".json":
        source_type = SourceType.TEXT
        with open(path, encoding="utf-8") as f:
            items = json.load(f)
        for item in items:
            question = item.get("question", "")
            answer = item.get("expected_answer", "")
            if answer:
                raw_chunks.append(f"Pergunta: {question}\nResposta: {answer}")
            else:
                raw_chunks.append(f"Pergunta: {question}")

    elif suffix == ".pdf":
        source_type = SourceType.PDF
        try:
            import pdfplumber
        except ImportError:
            raise ImportError("Run: pip install pdfplumber")
        with pdfplumber.open(path) as pdf:
            full_text = "\n".join(page.extract_text() or "" for page in pdf.pages)
        raw_chunks = _chunk_text(full_text, chunk_size=500, overlap=50)

    elif suffix == ".md":
        source_type = SourceType.MARKDOWN
        with open(path, encoding="utf-8") as f:
            content = f.read()
        # split by ## headings first; fall back to fixed-size chunks
        sections = [s.strip() for s in content.split("\n## ") if s.strip()]
        for section in sections:
            if len(section) <= 500:
                raw_chunks.append(section)
            else:
                raw_chunks.extend(_chunk_text(section, chunk_size=500, overlap=50))

    else:
        raise ValueError(f"Unsupported file extension: {suffix}")

    # check which chunk_indexes already exist for this source to avoid duplicates
    existing_indexes = set(
        session.exec(
            select(DocumentChunk.chunk_index).where(DocumentChunk.source_name == filename)
        ).all()
    )

    to_create = [
        (idx, text)
        for idx, text in enumerate(raw_chunks)
        if idx not in existing_indexes
    ]

    if not to_create:
        return IngestResponse(
            filename=filename,
            source_type=source_type.value,
            chunks_created=0,
            chunks_skipped=len(raw_chunks),
        )

    texts = [text for _, text in to_create]
    from app.services.embedding_service import generate_embeddings_batch
    embeddings = generate_embeddings_batch(texts)

    for (idx, text), embedding in zip(to_create, embeddings):
        chunk = DocumentChunk(
            content=text,
            embedding=embedding,
            source_name=filename,
            source_type=source_type,
            chunk_index=idx,
            chunk_size=len(text),
            chunk_overlap=50 if suffix != ".json" else 0,
            embedding_model="all-MiniLM-L6-v2",
        )
        session.add(chunk)

    session.commit()
    logger.info(f"Ingested {len(to_create)} chunks from {filename}")

    return IngestResponse(
        filename=filename,
        source_type=source_type.value,
        chunks_created=len(to_create),
        chunks_skipped=len(existing_indexes),
    )


def search_chunks(session: Session, query: str, retrieval_source: str, limit: int = 5) -> list[DocumentChunk]:
    """
    Search document_chunks by semantic similarity filtered by retrieval_source.
    retrieval_source: "json" → TEXT, "pdf" → PDF, "md" → MARKDOWN
    """
    from app.services.embedding_service import generate_embedding

    source_map = {
        "json": SourceType.TEXT,
        "pdf": SourceType.PDF,
        "md": SourceType.MARKDOWN,
    }
    source_type = source_map.get(retrieval_source, SourceType.TEXT)

    query_embedding = generate_embedding(query)

    results = session.exec(
        select(DocumentChunk)
        .where(DocumentChunk.source_type == source_type)
        .where(DocumentChunk.embedding.isnot(None))
        .order_by(DocumentChunk.embedding.cosine_distance(query_embedding))
        .limit(limit)
    ).all()

    return list(results)
