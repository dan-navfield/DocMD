from __future__ import annotations

import os
import subprocess
import tempfile
import uuid

from fastapi import HTTPException, UploadFile

from app.services.audit_service import AuditService


class TemplateService:
    def __init__(self, supabase):
        self.supabase = supabase
        self.audit = AuditService(supabase)

    async def create_template(
        self,
        user_id: str,
        name: str,
        description: str,
        file: UploadFile,
    ) -> dict:
        template_id = str(uuid.uuid4())
        storage_path = f"{user_id}/{template_id}/{file.filename}"

        content = await file.read()
        self.supabase.storage.from_("templates").upload(
            storage_path,
            content,
            {"content-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"},
        )

        result = self.supabase.table("templates").insert({
            "id": template_id,
            "name": name,
            "description": description,
            "file_storage_path": storage_path,
            "created_by": user_id,
        }).execute()

        await self.audit.log(user_id, "template.created", "template", template_id)
        return result.data[0]

    async def list_templates(self) -> list[dict]:
        result = self.supabase.table("templates").select("*").order("created_at", desc=True).execute()
        return result.data

    async def get_template(self, template_id: str) -> dict:
        result = self.supabase.table("templates").select("*").eq("id", template_id).single().execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="Template not found")
        return result.data

    async def update_template(self, template_id: str, user_id: str, body) -> dict:
        update_data = body.model_dump(exclude_none=True)
        result = (
            self.supabase.table("templates")
            .update(update_data)
            .eq("id", template_id)
            .execute()
        )
        if not result.data:
            raise HTTPException(status_code=404, detail="Template not found")
        await self.audit.log(user_id, "template.updated", "template", template_id)
        return result.data[0]

    async def delete_template(self, template_id: str, user_id: str):
        result = self.supabase.table("templates").delete().eq("id", template_id).execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="Template not found")
        await self.audit.log(user_id, "template.deleted", "template", template_id)

    async def download_template(self, template_id: str) -> tuple[bytes, str]:
        template = await self.get_template(template_id)
        file_bytes = self.supabase.storage.from_("templates").download(
            template["file_storage_path"]
        )
        filename = template["file_storage_path"].rsplit("/", 1)[-1]
        return file_bytes, filename

    async def get_template_preview_pdf(self, template_id: str) -> bytes:
        file_bytes, filename = await self.download_template(template_id)
        with tempfile.TemporaryDirectory() as tmpdir:
            docx_path = os.path.join(tmpdir, filename)
            with open(docx_path, "wb") as f:
                f.write(file_bytes)
            result = subprocess.run(
                ["soffice", "--headless", "--convert-to", "pdf", docx_path, "--outdir", tmpdir],
                capture_output=True, timeout=60,
            )
            if result.returncode != 0:
                raise HTTPException(status_code=500, detail="PDF conversion failed")
            pdf_name = os.path.splitext(filename)[0] + ".pdf"
            pdf_path = os.path.join(tmpdir, pdf_name)
            if not os.path.exists(pdf_path):
                raise HTTPException(status_code=500, detail="PDF output not found")
            with open(pdf_path, "rb") as f:
                return f.read()

    async def save_template_version(
        self,
        template_id: str,
        user_id: str,
        file_bytes: bytes,
    ) -> dict:
        """Save an edited version of a template file."""
        template = await self.get_template(template_id)
        storage_path = template["file_storage_path"]
        new_version = template["version"] + 1

        # Overwrite file in Supabase Storage (remove then upload for reliability)
        self.supabase.storage.from_("templates").remove([storage_path])
        self.supabase.storage.from_("templates").upload(
            storage_path,
            file_bytes,
            {"content-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"},
        )

        result = (
            self.supabase.table("templates")
            .update({"version": new_version})
            .eq("id", template_id)
            .execute()
        )

        await self.audit.log(
            user_id, "template.edited", "template", template_id,
            {"new_version": new_version},
        )
        return result.data[0] if result.data else template

    async def get_template_styles(self, template_id: str) -> dict:
        template = await self.get_template(template_id)
        file_bytes = self.supabase.storage.from_("templates").download(
            template["file_storage_path"]
        )

        from app.engine.template_reader import extract_styles, extract_used_styles
        styles = extract_styles(file_bytes)
        used_styles = extract_used_styles(file_bytes)

        return {"template_id": template_id, "styles": styles, "used_styles": used_styles}

    async def get_style_map(self, template_id: str) -> dict:
        template = await self.get_template(template_id)
        file_bytes = self.supabase.storage.from_("templates").download(
            template["file_storage_path"]
        )

        from app.engine.template_reader import extract_style_map
        paragraphs = extract_style_map(file_bytes)

        return {"template_id": template_id, "paragraphs": paragraphs}
