from __future__ import annotations

import uuid
from typing import Optional

from fastapi import HTTPException, UploadFile

from app.models.document import DocumentUpdate
from app.services.audit_service import AuditService


class DocumentService:
    def __init__(self, supabase):
        self.supabase = supabase
        self.audit = AuditService(supabase)

    async def create_document(
        self,
        user_id: str,
        title: str,
        project_id: Optional[str],
        doc_type: str,
        tags: list[str],
        file: Optional[UploadFile] = None,
        markdown_text: Optional[str] = None,
    ) -> dict:
        if not file and not markdown_text:
            raise HTTPException(status_code=400, detail="Provide either a file or markdown text")

        doc_id = str(uuid.uuid4())
        storage_path = f"{user_id}/{doc_id}/v1.md"

        # Upload markdown to storage
        if file:
            content = await file.read()
        else:
            content = markdown_text.encode("utf-8")

        self.supabase.storage.from_("markdown-sources").upload(
            storage_path, content, {"content-type": "text/markdown"}
        )

        # Create document record
        doc_data = {
            "id": doc_id,
            "title": title,
            "project_id": project_id,
            "doc_type": doc_type,
            "tags": tags,
            "metadata": {},
            "markdown_storage_path": storage_path,
            "current_version": 1,
            "created_by": user_id,
            "status": "received",
        }
        result = self.supabase.table("documents").insert(doc_data).execute()

        # Create initial version
        self.supabase.table("document_versions").insert({
            "document_id": doc_id,
            "version_number": 1,
            "markdown_storage_path": storage_path,
            "created_by": user_id,
        }).execute()

        await self.audit.log(user_id, "document.created", "document", doc_id)
        return result.data[0]

    async def list_documents(
        self,
        user_id: str,
        project_id: Optional[str] = None,
        status: Optional[str] = None,
        doc_type: Optional[str] = None,
        search: Optional[str] = None,
        offset: int = 0,
        limit: int = 50,
    ) -> list[dict]:
        query = self.supabase.table("documents").select("*")

        if project_id:
            query = query.eq("project_id", project_id)
        if status:
            query = query.eq("status", status)
        if doc_type:
            query = query.eq("doc_type", doc_type)
        if search:
            query = query.ilike("title", f"%{search}%")

        result = query.order("created_at", desc=True).range(offset, offset + limit - 1).execute()
        return result.data

    async def get_document(self, document_id: str, user_id: str) -> dict:
        result = self.supabase.table("documents").select("*").eq("id", document_id).single().execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="Document not found")
        return result.data

    async def update_document(self, document_id: str, user_id: str, body: DocumentUpdate) -> dict:
        update_data = body.model_dump(exclude_none=True)
        if "metadata" in update_data and update_data["metadata"]:
            update_data["metadata"] = update_data["metadata"]

        result = (
            self.supabase.table("documents")
            .update(update_data)
            .eq("id", document_id)
            .execute()
        )
        if not result.data:
            raise HTTPException(status_code=404, detail="Document not found")

        await self.audit.log(user_id, "document.updated", "document", document_id)
        return result.data[0]

    async def delete_document(self, document_id: str, user_id: str):
        result = self.supabase.table("documents").delete().eq("id", document_id).execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="Document not found")
        await self.audit.log(user_id, "document.deleted", "document", document_id)

    async def list_versions(self, document_id: str, user_id: str) -> list[dict]:
        # Verify access
        await self.get_document(document_id, user_id)
        result = (
            self.supabase.table("document_versions")
            .select("*")
            .eq("document_id", document_id)
            .order("version_number", desc=True)
            .execute()
        )
        return result.data
