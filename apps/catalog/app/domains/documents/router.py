from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlmodel import Session

from app.api.dependencies import get_current_user_id, get_db
from app.domains.documents.service import index_document
from app.core.config import settings
from app.domains.documents.repository import DocumentRepository
from app.domains.documents.schemas import (
    ConfirmUploadResponse,
    DocumentResponse,
    DownloadUrlResponse,
    UploadUrlRequest,
    UploadUrlResponse,
)
from app.infrastructure.s3.repository import (
    generate_download_url,
    generate_upload_url,
    object_exists,
)

router = APIRouter()


def _get_repo(session: Session = Depends(get_db)) -> DocumentRepository:
    return DocumentRepository(session)


_Repo = Annotated[DocumentRepository, Depends(_get_repo)]


def _require_bucket() -> None:
    if not settings.AWS_S3_BUCKET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AWS_S3_BUCKET is not configured",
        )


@router.post(
    "/upload-url",
    response_model=UploadUrlResponse,
    status_code=status.HTTP_201_CREATED,
)
async def request_upload_url(
    body: UploadUrlRequest,
    repo: _Repo,
    current_user_id: str = Depends(get_current_user_id),
) -> UploadUrlResponse:
    _require_bucket()
    doc = repo.create(
        user_id=current_user_id,
        name=body.name,
        b2_key="",  # filled in below after we have the id
        mime_type=body.mime_type,
    )
    b2_key = f"users/{current_user_id}/{doc.id}.pdf"
    # Update the key now that we have the document id
    doc.b2_key = b2_key
    repo.session.add(doc)
    repo.session.commit()
    repo.session.refresh(doc)

    upload_url = generate_upload_url(b2_key)
    return UploadUrlResponse(
        document_id=doc.id,
        upload_url=upload_url,
        b2_key=b2_key,
    )


@router.post("/{document_id}/confirm", response_model=ConfirmUploadResponse)
async def confirm_upload(
    document_id: UUID,
    background_tasks: BackgroundTasks,
    repo: _Repo,
    session: Session = Depends(get_db),
    current_user_id: str = Depends(get_current_user_id),
) -> ConfirmUploadResponse:
    _require_bucket()
    doc = repo.get(document_id)
    if doc is None or doc.user_id != current_user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    exists, size_bytes = object_exists(doc.b2_key)
    if not exists:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="File not found in storage — upload may not have completed",
        )

    doc = repo.update_after_upload(document_id, size_bytes)
    background_tasks.add_task(index_document, session, document_id)
    return ConfirmUploadResponse(
        document_id=doc.id,
        status=doc.status,
        size_bytes=doc.size_bytes,
    )


@router.get("/{document_id}/download-url", response_model=DownloadUrlResponse)
async def get_download_url(
    document_id: UUID,
    repo: _Repo,
    current_user_id: str = Depends(get_current_user_id),
) -> DownloadUrlResponse:
    _require_bucket()
    doc = repo.get(document_id)
    if doc is None or doc.user_id != current_user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    download_url = generate_download_url(doc.b2_key)
    return DownloadUrlResponse(download_url=download_url)


@router.get("/", response_model=list[DocumentResponse])
async def list_documents(
    repo: _Repo,
    current_user_id: str = Depends(get_current_user_id),
) -> list[DocumentResponse]:
    return repo.list_for_user(current_user_id)
