from __future__ import annotations

import io
import uuid
from typing import Optional

from fastapi import HTTPException

from app.services.audit_service import AuditService


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
            docx_bytes, report = converter.convert(
                markdown_text=markdown_text,
                template_bytes=template_bytes,
                mapping_rules=mapping.data["rules"],
            )

            # Upload generated docx
            output_path = f"{user_id}/{document_id}/{conversion_id}.docx"
            self.supabase.storage.from_("generated-docs").upload(
                output_path, docx_bytes, {"content-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"}
            )

            # Update conversion record
            result = (
                self.supabase.table("conversions")
                .update({
                    "status": "completed",
                    "output_storage_path": output_path,
                    "warnings": report.get("warnings_text", []),
                    "conversion_report": report,
                    "completed_at": "now()",
                })
                .eq("id", conversion_id)
                .execute()
            )

            # Update document status
            self.supabase.table("documents").update({"status": "converted"}).eq("id", document_id).execute()

            await self.audit.log(user_id, "conversion.completed", "conversion", conversion_id)
            return result.data[0]

        except Exception as e:
            self.supabase.table("conversions").update({
                "status": "failed",
                "conversion_report": {"error": str(e)},
                "completed_at": "now()",
            }).eq("id", conversion_id).execute()

            await self.audit.log(user_id, "conversion.failed", "conversion", conversion_id, {"error": str(e)})
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
