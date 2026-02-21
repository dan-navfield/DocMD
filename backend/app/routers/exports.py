from __future__ import annotations

from fastapi import APIRouter, Depends

from app.dependencies import get_current_user, get_supabase_admin
from app.models.export import ExportCreate, ExportResponse
from app.services.export_service import ExportService

router = APIRouter(prefix="/api", tags=["exports"])


def get_service(supabase=Depends(get_supabase_admin)):
    return ExportService(supabase)


@router.post("/conversions/{conversion_id}/export", response_model=ExportResponse)
async def export_conversion(
    conversion_id: str,
    body: ExportCreate,
    user: dict = Depends(get_current_user),
    service: ExportService = Depends(get_service),
):
    return await service.export_conversion(
        conversion_id=conversion_id,
        destination_id=body.destination_id,
        user_id=user["id"],
    )


@router.get("/exports/{export_id}", response_model=ExportResponse)
async def get_export(
    export_id: str,
    user: dict = Depends(get_current_user),
    service: ExportService = Depends(get_service),
):
    return await service.get_export(export_id, user["id"])
