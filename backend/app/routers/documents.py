from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, UploadFile, HTTPException
from typing import Optional

from app.dependencies import get_current_user, get_supabase_client, get_supabase_admin
from app.models.document import (
    DocumentCreate,
    DocumentListParams,
    DocumentResponse,
    DocumentUpdate,
    DocumentVersionResponse,
)
from app.services.document_service import DocumentService

router = APIRouter(prefix="/api/documents", tags=["documents"])


def get_service(supabase=Depends(get_supabase_admin)):
    return DocumentService(supabase)


@router.post("", response_model=DocumentResponse)
async def create_document(
    title: str = Form(...),
    project_id: Optional[str] = Form(None),
    doc_type: Optional[str] = Form(""),
    tags: Optional[str] = Form(""),
    file: Optional[UploadFile] = File(None),
    markdown: Optional[str] = Form(None),
    user: dict = Depends(get_current_user),
    service: DocumentService = Depends(get_service),
):
    tag_list = [t.strip() for t in tags.split(",") if t.strip()] if tags else []
    return await service.create_document(
        user_id=user["id"],
        title=title,
        project_id=project_id,
        doc_type=doc_type or "",
        tags=tag_list,
        file=file,
        markdown_text=markdown,
    )


@router.get("", response_model=list[DocumentResponse])
async def list_documents(
    project_id: Optional[str] = None,
    status: Optional[str] = None,
    doc_type: Optional[str] = None,
    search: Optional[str] = None,
    offset: int = 0,
    limit: int = 50,
    user: dict = Depends(get_current_user),
    service: DocumentService = Depends(get_service),
):
    return await service.list_documents(
        user_id=user["id"],
        project_id=project_id,
        status=status,
        doc_type=doc_type,
        search=search,
        offset=offset,
        limit=limit,
    )


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: str,
    user: dict = Depends(get_current_user),
    service: DocumentService = Depends(get_service),
):
    return await service.get_document(document_id, user["id"])


@router.patch("/{document_id}", response_model=DocumentResponse)
async def update_document(
    document_id: str,
    body: DocumentUpdate,
    user: dict = Depends(get_current_user),
    service: DocumentService = Depends(get_service),
):
    return await service.update_document(document_id, user["id"], body)


@router.delete("/{document_id}")
async def delete_document(
    document_id: str,
    user: dict = Depends(get_current_user),
    service: DocumentService = Depends(get_service),
):
    await service.delete_document(document_id, user["id"])
    return {"ok": True}


@router.get("/{document_id}/versions", response_model=list[DocumentVersionResponse])
async def list_versions(
    document_id: str,
    user: dict = Depends(get_current_user),
    service: DocumentService = Depends(get_service),
):
    return await service.list_versions(document_id, user["id"])
