from __future__ import annotations

import uuid

from fastapi import HTTPException

from app.models.mapping import MappingCreate, MappingUpdate
from app.services.audit_service import AuditService


class MappingService:
    def __init__(self, supabase):
        self.supabase = supabase
        self.audit = AuditService(supabase)

    async def create_mapping(self, user_id: str, body: MappingCreate) -> dict:
        mapping_id = str(uuid.uuid4())
        result = self.supabase.table("mappings").insert({
            "id": mapping_id,
            "name": body.name,
            "template_id": body.template_id,
            "rules": body.rules.model_dump(),
            "is_default": body.is_default,
            "created_by": user_id,
        }).execute()

        await self.audit.log(user_id, "mapping.created", "mapping", mapping_id)
        return result.data[0]

    async def list_mappings(self, template_id: str = None) -> list[dict]:
        query = self.supabase.table("mappings").select("*")
        if template_id:
            query = query.eq("template_id", template_id)
        result = query.order("created_at", desc=True).execute()
        return result.data

    async def get_mapping(self, mapping_id: str) -> dict:
        result = self.supabase.table("mappings").select("*").eq("id", mapping_id).single().execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="Mapping not found")
        return result.data

    async def update_mapping(self, mapping_id: str, user_id: str, body: MappingUpdate) -> dict:
        update_data = body.model_dump(exclude_none=True)
        if "rules" in update_data:
            update_data["rules"] = update_data["rules"]

        # Bump version
        current = await self.get_mapping(mapping_id)
        update_data["version"] = current["version"] + 1

        result = (
            self.supabase.table("mappings")
            .update(update_data)
            .eq("id", mapping_id)
            .execute()
        )
        if not result.data:
            raise HTTPException(status_code=404, detail="Mapping not found")
        await self.audit.log(user_id, "mapping.updated", "mapping", mapping_id)
        return result.data[0]

    async def delete_mapping(self, mapping_id: str, user_id: str):
        result = self.supabase.table("mappings").delete().eq("id", mapping_id).execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="Mapping not found")
        await self.audit.log(user_id, "mapping.deleted", "mapping", mapping_id)
