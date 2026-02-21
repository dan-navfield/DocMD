from __future__ import annotations

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

    async def get_template_styles(self, template_id: str) -> dict:
        template = await self.get_template(template_id)
        file_bytes = self.supabase.storage.from_("templates").download(
            template["file_storage_path"]
        )

        from app.engine.template_reader import extract_styles
        styles = extract_styles(file_bytes)

        return {"template_id": template_id, "styles": styles}
