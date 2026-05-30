from typing import Optional
from uuid import UUID

from sqlmodel import Session, select

from app.models.documents import Document, DocumentStatus


class DocumentRepository:
    def __init__(self, session: Session):
        self.session = session

    def create(self, user_id: str, name: str, b2_key: str, mime_type: str) -> Document:
        doc = Document(user_id=user_id, name=name, b2_key=b2_key, mime_type=mime_type)
        self.session.add(doc)
        self.session.commit()
        self.session.refresh(doc)
        return doc

    def get(self, document_id: UUID) -> Optional[Document]:
        return self.session.get(Document, document_id)

    def list_for_user(self, user_id: str) -> list[Document]:
        return list(
            self.session.exec(
                select(Document).where(Document.user_id == user_id)
            ).all()
        )

    def update_after_upload(
        self, document_id: UUID, size_bytes: Optional[int]
    ) -> Document:
        doc = self.session.get(Document, document_id)
        if doc is None:
            raise ValueError(f"Document {document_id} not found")
        doc.size_bytes = size_bytes
        doc.status = DocumentStatus.PENDING  # stays PENDING until indexed
        self.session.add(doc)
        self.session.commit()
        self.session.refresh(doc)
        return doc
