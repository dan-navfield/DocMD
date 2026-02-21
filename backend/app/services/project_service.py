from __future__ import annotations

import uuid

from fastapi import HTTPException

from app.models.project import ProjectCreate, ProjectMemberCreate, ProjectUpdate
from app.models.export import DestinationCreate
from app.services.audit_service import AuditService


class ProjectService:
    def __init__(self, supabase):
        self.supabase = supabase
        self.audit = AuditService(supabase)

    async def create_project(self, user_id: str, body: ProjectCreate) -> dict:
        project_id = str(uuid.uuid4())
        result = self.supabase.table("projects").insert({
            "id": project_id,
            "name": body.name,
            "description": body.description,
            "naming_rules": body.naming_rules.model_dump(),
            "owner_id": user_id,
        }).execute()

        # Add owner as member
        self.supabase.table("project_members").insert({
            "project_id": project_id,
            "user_id": user_id,
            "role": "owner",
        }).execute()

        await self.audit.log(user_id, "project.created", "project", project_id)
        return result.data[0]

    async def list_projects(self, user_id: str) -> list[dict]:
        # Get projects where user is owner or member
        member_result = (
            self.supabase.table("project_members")
            .select("project_id")
            .eq("user_id", user_id)
            .execute()
        )
        project_ids = [m["project_id"] for m in member_result.data]

        if not project_ids:
            return []

        result = (
            self.supabase.table("projects")
            .select("*")
            .in_("id", project_ids)
            .order("created_at", desc=True)
            .execute()
        )
        return result.data

    async def get_project(self, project_id: str, user_id: str) -> dict:
        result = self.supabase.table("projects").select("*").eq("id", project_id).single().execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="Project not found")
        return result.data

    async def update_project(self, project_id: str, user_id: str, body: ProjectUpdate) -> dict:
        update_data = body.model_dump(exclude_none=True)
        if "naming_rules" in update_data:
            update_data["naming_rules"] = update_data["naming_rules"]

        result = (
            self.supabase.table("projects")
            .update(update_data)
            .eq("id", project_id)
            .execute()
        )
        if not result.data:
            raise HTTPException(status_code=404, detail="Project not found")
        await self.audit.log(user_id, "project.updated", "project", project_id)
        return result.data[0]

    async def delete_project(self, project_id: str, user_id: str):
        result = self.supabase.table("projects").delete().eq("id", project_id).execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="Project not found")
        await self.audit.log(user_id, "project.deleted", "project", project_id)

    async def add_member(self, project_id: str, user_id: str, body: ProjectMemberCreate) -> dict:
        result = self.supabase.table("project_members").insert({
            "project_id": project_id,
            "user_id": body.user_id,
            "role": body.role.value,
        }).execute()
        await self.audit.log(user_id, "project.member_added", "project", project_id)
        return result.data[0]

    async def list_members(self, project_id: str, user_id: str) -> list[dict]:
        result = (
            self.supabase.table("project_members")
            .select("*")
            .eq("project_id", project_id)
            .execute()
        )
        return result.data

    async def remove_member(self, project_id: str, user_id: str, member_user_id: str):
        self.supabase.table("project_members").delete().eq(
            "project_id", project_id
        ).eq("user_id", member_user_id).execute()
        await self.audit.log(user_id, "project.member_removed", "project", project_id)

    async def create_destination(self, project_id: str, user_id: str, body: DestinationCreate) -> dict:
        dest_id = str(uuid.uuid4())
        result = self.supabase.table("destinations").insert({
            "id": dest_id,
            "project_id": project_id,
            "name": body.name,
            "type": body.type.value,
            "config": body.config,
            "folder_rules": body.folder_rules,
            "created_by": user_id,
        }).execute()
        await self.audit.log(user_id, "destination.created", "destination", dest_id)
        return result.data[0]

    async def list_destinations(self, project_id: str, user_id: str) -> list[dict]:
        result = (
            self.supabase.table("destinations")
            .select("*")
            .eq("project_id", project_id)
            .execute()
        )
        return result.data
