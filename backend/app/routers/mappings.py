from __future__ import annotations

from fastapi import APIRouter, Depends

from app.dependencies import get_current_user, get_supabase_admin
from app.models.mapping import MappingCreate, MappingResponse, MappingUpdate
from app.services.mapping_service import MappingService

router = APIRouter(prefix="/api/mappings", tags=["mappings"])


def get_service(supabase=Depends(get_supabase_admin)):
    return MappingService(supabase)


@router.post("", response_model=MappingResponse)
async def create_mapping(
    body: MappingCreate,
    user: dict = Depends(get_current_user),
    service: MappingService = Depends(get_service),
):
    return await service.create_mapping(user["id"], body)


@router.get("", response_model=list[MappingResponse])
async def list_mappings(
    template_id: str = None,
    user: dict = Depends(get_current_user),
    service: MappingService = Depends(get_service),
):
    return await service.list_mappings(template_id=template_id)


@router.get("/{mapping_id}", response_model=MappingResponse)
async def get_mapping(
    mapping_id: str,
    user: dict = Depends(get_current_user),
    service: MappingService = Depends(get_service),
):
    return await service.get_mapping(mapping_id)


@router.patch("/{mapping_id}", response_model=MappingResponse)
async def update_mapping(
    mapping_id: str,
    body: MappingUpdate,
    user: dict = Depends(get_current_user),
    service: MappingService = Depends(get_service),
):
    return await service.update_mapping(mapping_id, user["id"], body)


@router.delete("/{mapping_id}")
async def delete_mapping(
    mapping_id: str,
    user: dict = Depends(get_current_user),
    service: MappingService = Depends(get_service),
):
    await service.delete_mapping(mapping_id, user["id"])
    return {"ok": True}
