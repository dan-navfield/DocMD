from __future__ import annotations

import os

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response

from app.config import get_settings
from app.dependencies import get_current_user, get_supabase_admin
from app.models.font import FontResponse, FontUploadResponse
from app.services.font_service import FontService

router = APIRouter(prefix="/api/fonts", tags=["fonts"])


def get_service(supabase=Depends(get_supabase_admin)):
    return FontService(supabase)


@router.post("", response_model=FontUploadResponse)
async def upload_fonts(
    files: list[UploadFile] = File(...),
    user: dict = Depends(get_current_user),
    service: FontService = Depends(get_service),
):
    return await service.upload_fonts(user["id"], files)


@router.get("", response_model=list[FontResponse])
async def list_fonts(
    user: dict = Depends(get_current_user),
    service: FontService = Depends(get_service),
):
    return await service.list_fonts()


@router.get("/{font_id}/file")
async def serve_font_file(
    font_id: str,
    user: dict = Depends(get_current_user),
    service: FontService = Depends(get_service),
):
    font = await service.get_font(font_id)
    settings = get_settings()
    local_path = os.path.join(settings.fonts_dir, font["filename"])
    if not os.path.exists(local_path):
        raise HTTPException(status_code=404, detail="Font file not found on disk")
    with open(local_path, "rb") as f:
        data = f.read()
    return Response(
        content=data,
        media_type=font["mime_type"],
        headers={"Cache-Control": "public, max-age=86400"},
    )


@router.delete("/{font_id}")
async def delete_font(
    font_id: str,
    user: dict = Depends(get_current_user),
    service: FontService = Depends(get_service),
):
    await service.delete_font(font_id, user["id"])
    return {"ok": True}
