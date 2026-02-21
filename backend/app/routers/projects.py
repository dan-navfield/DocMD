from __future__ import annotations

from fastapi import APIRouter, Depends

from app.dependencies import get_current_user, get_supabase_admin
from app.models.project import (
    ProjectCreate,
    ProjectMemberCreate,
    ProjectMemberResponse,
    ProjectResponse,
    ProjectUpdate,
)
from app.models.export import DestinationCreate, DestinationResponse, DestinationUpdate
from app.services.project_service import ProjectService

router = APIRouter(prefix="/api/projects", tags=["projects"])


def get_service(supabase=Depends(get_supabase_admin)):
    return ProjectService(supabase)


@router.post("", response_model=ProjectResponse)
async def create_project(
    body: ProjectCreate,
    user: dict = Depends(get_current_user),
    service: ProjectService = Depends(get_service),
):
    return await service.create_project(user["id"], body)


@router.get("", response_model=list[ProjectResponse])
async def list_projects(
    user: dict = Depends(get_current_user),
    service: ProjectService = Depends(get_service),
):
    return await service.list_projects(user["id"])


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: str,
    user: dict = Depends(get_current_user),
    service: ProjectService = Depends(get_service),
):
    return await service.get_project(project_id, user["id"])


@router.patch("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: str,
    body: ProjectUpdate,
    user: dict = Depends(get_current_user),
    service: ProjectService = Depends(get_service),
):
    return await service.update_project(project_id, user["id"], body)


@router.delete("/{project_id}")
async def delete_project(
    project_id: str,
    user: dict = Depends(get_current_user),
    service: ProjectService = Depends(get_service),
):
    await service.delete_project(project_id, user["id"])
    return {"ok": True}


# Members
@router.post("/{project_id}/members", response_model=ProjectMemberResponse)
async def add_member(
    project_id: str,
    body: ProjectMemberCreate,
    user: dict = Depends(get_current_user),
    service: ProjectService = Depends(get_service),
):
    return await service.add_member(project_id, user["id"], body)


@router.get("/{project_id}/members", response_model=list[ProjectMemberResponse])
async def list_members(
    project_id: str,
    user: dict = Depends(get_current_user),
    service: ProjectService = Depends(get_service),
):
    return await service.list_members(project_id, user["id"])


@router.delete("/{project_id}/members/{member_user_id}")
async def remove_member(
    project_id: str,
    member_user_id: str,
    user: dict = Depends(get_current_user),
    service: ProjectService = Depends(get_service),
):
    await service.remove_member(project_id, user["id"], member_user_id)
    return {"ok": True}


# Destinations
@router.post("/{project_id}/destinations", response_model=DestinationResponse)
async def create_destination(
    project_id: str,
    body: DestinationCreate,
    user: dict = Depends(get_current_user),
    service: ProjectService = Depends(get_service),
):
    return await service.create_destination(project_id, user["id"], body)


@router.get("/{project_id}/destinations", response_model=list[DestinationResponse])
async def list_destinations(
    project_id: str,
    user: dict = Depends(get_current_user),
    service: ProjectService = Depends(get_service),
):
    return await service.list_destinations(project_id, user["id"])
