from __future__ import annotations

import io
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException

import logging

from app.services.audit_service import AuditService

logger = logging.getLogger(__name__)


class ConversionService:
    def __init__(self, supabase):
        self.supabase = supabase
        self.audit = AuditService(supabase)

    async def convert_document(
        self,
        document_id: str,
        template_id: str,
        mapping_id: str,
        user_id: str,
        mapping_rules_override: dict | None = None,
    ) -> dict:
        # Fetch document
        doc = self.supabase.table("documents").select("*").eq("id", document_id).single().execute()
        if not doc.data:
            raise HTTPException(status_code=404, detail="Document not found")

        # Fetch template
        template = self.supabase.table("templates").select("*").eq("id", template_id).single().execute()
        if not template.data:
            raise HTTPException(status_code=404, detail="Template not found")

        # Fetch mapping
        mapping = self.supabase.table("mappings").select("*").eq("id", mapping_id).single().execute()
        if not mapping.data:
            raise HTTPException(status_code=404, detail="Mapping not found")

        # Create conversion record
        conversion_id = str(uuid.uuid4())
        conversion_data = {
            "id": conversion_id,
            "document_id": document_id,
            "template_id": template_id,
            "mapping_id": mapping_id,
            "status": "processing",
            "started_by": user_id,
        }
        self.supabase.table("conversions").insert(conversion_data).execute()

        try:
            # Download markdown source
            md_bytes = self.supabase.storage.from_("markdown-sources").download(
                doc.data["markdown_storage_path"]
            )
            markdown_text = md_bytes.decode("utf-8")

            # Download template file
            template_bytes = self.supabase.storage.from_("templates").download(
                template.data["file_storage_path"]
            )

            # Run conversion engine
            from app.engine.converter import MarkdownToWordConverter

            converter = MarkdownToWordConverter()
            rules = mapping_rules_override if mapping_rules_override else mapping.data["rules"]
            docx_bytes, report = converter.convert(
                markdown_text=markdown_text,
                template_bytes=template_bytes,
                mapping_rules=rules,
            )

            # Upload generated docx
            output_path = f"{user_id}/{document_id}/{conversion_id}.docx"
            self.supabase.storage.from_("generated-docs").upload(
                output_path, docx_bytes, {"content-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"}
            )

            # Update conversion record
            now = datetime.now(timezone.utc).isoformat()
            self.supabase.table("conversions").update({
                "status": "completed",
                "output_storage_path": output_path,
                "warnings": report.get("warnings_text", []),
                "conversion_report": report,
                "completed_at": now,
            }).eq("id", conversion_id).execute()

            # Update document status
            self.supabase.table("documents").update({"status": "converted"}).eq("id", document_id).execute()

            await self.audit.log(user_id, "conversion.completed", "conversion", conversion_id)

            # Fetch the final record to return
            final = self.supabase.table("conversions").select("*").eq("id", conversion_id).single().execute()
            return final.data

        except Exception as e:
            import traceback
            logger.error("Conversion failed:\n%s", traceback.format_exc())
            fail_now = datetime.now(timezone.utc).isoformat()
            self.supabase.table("conversions").update({
                "status": "failed",
                "conversion_report": {"error": str(e)},
                "completed_at": fail_now,
            }).eq("id", conversion_id).execute()

            await self.audit.log(user_id, "conversion.failed", "conversion", conversion_id, {"error": str(e)})
            raise HTTPException(status_code=500, detail=f"Conversion failed: {str(e)}")

    async def convert_markdown_direct(
        self,
        markdown_text: str,
        template_id: str,
        mapping_id: str,
        user_id: str,
        filename: str = "document",
    ) -> dict:
        """Single-call conversion for the public API.

        Creates document + conversion records for audit/billing, runs the
        conversion engine synchronously, and returns a dict with
        ``conversion_id``, ``docx_bytes``, ``warnings``, ``stats``, and
        ``created_at``.
        """
        # Validate template
        template = self.supabase.table("templates").select("*").eq("id", template_id).single().execute()
        if not template.data:
            raise HTTPException(status_code=404, detail="Template not found")

        # Validate mapping
        mapping = self.supabase.table("mappings").select("*").eq("id", mapping_id).single().execute()
        if not mapping.data:
            raise HTTPException(status_code=404, detail="Mapping not found")

        # Create a document record for audit trail
        document_id = str(uuid.uuid4())
        md_storage_path = f"{user_id}/{document_id}/source.md"
        self.supabase.storage.from_("markdown-sources").upload(
            md_storage_path,
            markdown_text.encode("utf-8"),
            {"content-type": "text/markdown"},
        )
        now = datetime.now(timezone.utc).isoformat()
        self.supabase.table("documents").insert({
            "id": document_id,
            "title": filename,
            "markdown_storage_path": md_storage_path,
            "doc_type": "api",
            "tags": ["api-generated"],
            "status": "uploaded",
            "created_by": user_id,
        }).execute()

        # Create conversion record
        conversion_id = str(uuid.uuid4())
        self.supabase.table("conversions").insert({
            "id": conversion_id,
            "document_id": document_id,
            "template_id": template_id,
            "mapping_id": mapping_id,
            "status": "processing",
            "started_by": user_id,
        }).execute()

        try:
            # Download template file
            template_bytes = self.supabase.storage.from_("templates").download(
                template.data["file_storage_path"]
            )

            # Run conversion engine
            from app.engine.converter import MarkdownToWordConverter

            converter = MarkdownToWordConverter()
            docx_bytes, report = converter.convert(
                markdown_text=markdown_text,
                template_bytes=template_bytes,
                mapping_rules=mapping.data["rules"],
            )

            # Upload generated docx
            output_path = f"{user_id}/{document_id}/{conversion_id}.docx"
            self.supabase.storage.from_("generated-docs").upload(
                output_path,
                docx_bytes,
                {"content-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"},
            )

            # Update records
            completed_at = datetime.now(timezone.utc).isoformat()
            self.supabase.table("conversions").update({
                "status": "completed",
                "output_storage_path": output_path,
                "warnings": report.get("warnings_text", []),
                "conversion_report": report,
                "completed_at": completed_at,
            }).eq("id", conversion_id).execute()

            self.supabase.table("documents").update({"status": "converted"}).eq("id", document_id).execute()

            await self.audit.log(user_id, "conversion.completed", "conversion", conversion_id, {"source": "api"})

            return {
                "conversion_id": conversion_id,
                "document_id": document_id,
                "docx_bytes": docx_bytes,
                "filename": filename,
                "warnings": report.get("warnings_text", []),
                "stats": report.get("stats", {}),
                "created_at": completed_at,
            }

        except Exception as e:
            import traceback
            logger.error("API conversion failed:\n%s", traceback.format_exc())
            fail_now = datetime.now(timezone.utc).isoformat()
            self.supabase.table("conversions").update({
                "status": "failed",
                "conversion_report": {"error": str(e)},
                "completed_at": fail_now,
            }).eq("id", conversion_id).execute()

            await self.audit.log(user_id, "conversion.failed", "conversion", conversion_id, {"error": str(e), "source": "api"})
            raise HTTPException(status_code=500, detail=f"Conversion failed: {str(e)}")

    async def get_conversion(self, conversion_id: str, user_id: str) -> dict:
        result = self.supabase.table("conversions").select("*").eq("id", conversion_id).single().execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="Conversion not found")
        return result.data

    async def download_conversion(self, conversion_id: str, user_id: str) -> tuple:
        conversion = await self.get_conversion(conversion_id, user_id)
        if not conversion.get("output_storage_path"):
            raise HTTPException(status_code=400, detail="No output file available")

        file_bytes = self.supabase.storage.from_("generated-docs").download(
            conversion["output_storage_path"]
        )

        # Get document title for filename
        doc = self.supabase.table("documents").select("title").eq("id", conversion["document_id"]).single().execute()
        filename = f"{doc.data['title']}.docx" if doc.data else "document.docx"

        return io.BytesIO(file_bytes), filename
