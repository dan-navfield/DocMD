from __future__ import annotations

import uuid

from fastapi import HTTPException

from app.services.audit_service import AuditService


class ExportService:
    def __init__(self, supabase):
        self.supabase = supabase
        self.audit = AuditService(supabase)

    async def export_conversion(
        self,
        conversion_id: str,
        destination_id: str,
        user_id: str,
    ) -> dict:
        # Fetch conversion
        conversion = self.supabase.table("conversions").select("*").eq("id", conversion_id).single().execute()
        if not conversion.data:
            raise HTTPException(status_code=404, detail="Conversion not found")
        if conversion.data["status"] != "completed":
            raise HTTPException(status_code=400, detail="Conversion not yet completed")

        # Fetch destination
        destination = self.supabase.table("destinations").select("*").eq("id", destination_id).single().execute()
        if not destination.data:
            raise HTTPException(status_code=404, detail="Destination not found")

        export_id = str(uuid.uuid4())
        export_data = {
            "id": export_id,
            "conversion_id": conversion_id,
            "destination_id": destination_id,
            "status": "exporting",
            "exported_by": user_id,
        }
        self.supabase.table("exports").insert(export_data).execute()

        try:
            dest_type = destination.data["type"]

            if dest_type == "sharepoint":
                exported_path = await self._export_to_sharepoint(
                    conversion.data, destination.data, user_id
                )
            elif dest_type == "supabase":
                exported_path = conversion.data["output_storage_path"]
            else:
                exported_path = conversion.data["output_storage_path"]

            result = (
                self.supabase.table("exports")
                .update({
                    "status": "completed",
                    "exported_path": exported_path,
                })
                .eq("id", export_id)
                .execute()
            )

            # Update document status
            doc_id = conversion.data["document_id"]
            self.supabase.table("documents").update({"status": "exported"}).eq("id", doc_id).execute()

            await self.audit.log(user_id, "export.completed", "export", export_id)
            return result.data[0]

        except Exception as e:
            self.supabase.table("exports").update({
                "status": "failed",
                "error_message": str(e),
            }).eq("id", export_id).execute()

            await self.audit.log(user_id, "export.failed", "export", export_id, {"error": str(e)})
            raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")

    async def _export_to_sharepoint(self, conversion: dict, destination: dict, user_id: str) -> str:
        from app.services.sharepoint_service import SharePointService
        from app.config import get_settings

        settings = get_settings()

        # Get user's Microsoft tokens
        user_settings = (
            self.supabase.table("user_settings")
            .select("microsoft_tokens_encrypted")
            .eq("user_id", user_id)
            .single()
            .execute()
        )
        if not user_settings.data or not user_settings.data.get("microsoft_tokens_encrypted"):
            raise HTTPException(status_code=400, detail="Microsoft account not connected")

        tokens = user_settings.data["microsoft_tokens_encrypted"]
        sp_service = SharePointService(settings)

        # Download the generated docx
        file_bytes = self.supabase.storage.from_("generated-docs").download(
            conversion["output_storage_path"]
        )

        # Resolve folder path
        doc = self.supabase.table("documents").select("*").eq("id", conversion["document_id"]).single().execute()
        folder_path = sp_service.resolve_folder_path(
            destination["folder_rules"],
            doc.data,
        )

        # Upload to SharePoint
        config = destination["config"]
        filename = f"{doc.data['title']}.docx"
        exported_path = await sp_service.upload_file(
            tokens=tokens,
            site_url=config.get("site_url", ""),
            library_name=config.get("library_name", ""),
            folder_path=folder_path,
            filename=filename,
            file_bytes=file_bytes,
        )

        return exported_path

    async def get_export(self, export_id: str, user_id: str) -> dict:
        result = self.supabase.table("exports").select("*").eq("id", export_id).single().execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="Export not found")
        return result.data
