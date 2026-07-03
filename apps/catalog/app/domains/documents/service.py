import io
import logging
from uuid import UUID

import pdfplumber
from sqlmodel import Session

from app.core.config import get_s3_client, settings
from app.models.documents import BlobChunk, Document, DocumentStatus
from app.services.embedding_service import generate_embeddings_batch

logger = logging.getLogger(__name__)

CHUNK_SIZE = 800
CHUNK_OVERLAP = 150
EMBEDDING_MODEL = "intfloat/multilingual-e5-base"


def _download_pdf(b2_key: str) -> bytes:
    s3 = get_s3_client()
    obj = s3.get_object(Bucket=settings.AWS_S3_BUCKET, Key=b2_key)
    return obj["Body"].read()


def _chunk_text(text: str) -> list[str]:
    chunks: list[str] = []
    start = 0
    while start < len(text):
        chunk = text[start : start + CHUNK_SIZE].strip()
        if chunk:
            chunks.append(chunk)
        start += CHUNK_SIZE - CHUNK_OVERLAP
    return chunks


def index_document(session: Session, document_id: UUID) -> None:
    doc = session.get(Document, document_id)
    if doc is None:
        raise ValueError(f"Document {document_id} not found")

    try:
        pdf_bytes = _download_pdf(doc.b2_key)

        # Extract text per page, keep track of page numbers
        page_chunks: list[tuple[str, int]] = []
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            doc.page_count = len(pdf.pages)
            for page_num, page in enumerate(pdf.pages, start=1):
                text = page.extract_text() or ""
                for chunk in _chunk_text(text):
                    page_chunks.append((chunk, page_num))

        if not page_chunks:
            raise ValueError("No text could be extracted from the PDF")

        texts = [c[0] for c in page_chunks]
        embeddings = generate_embeddings_batch(texts)

        for idx, ((text, page_num), embedding) in enumerate(zip(page_chunks, embeddings)):
            session.add(
                BlobChunk(
                    document_id=document_id,
                    chunk_index=idx,
                    content=text,
                    page_number=page_num,
                    chunk_size=CHUNK_SIZE,
                    chunk_overlap=CHUNK_OVERLAP,
                    embedding_model=EMBEDDING_MODEL,
                    embedding=embedding,
                )
            )

        doc.status = DocumentStatus.INDEXED
        doc.error_message = None
        logger.info(
            f"[index_document] Indexed {document_id}: {len(page_chunks)} chunks, "
            f"{doc.page_count} pages"
        )

    except Exception as exc:
        doc.status = DocumentStatus.FAILED
        doc.error_message = str(exc)[:1024]
        logger.error(f"[index_document] Failed to index {document_id}: {exc}")
        raise

    finally:
        session.add(doc)
        session.commit()
