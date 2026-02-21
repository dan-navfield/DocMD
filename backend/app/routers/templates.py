from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, UploadFile

from app.dependencies import get_current_user, get_supabase_admin
from app.models.template import TemplateResponse, TemplateStylesResponse, TemplateUpdate
from app.services.template_service import TemplateService

router = APIRouter(prefix="/api/templates", tags=["templates"])


def get_service(supabase=Depends(get_supabase_admin)):
    return TemplateService(supabase)


@router.post("", response_model=TemplateResponse)
async def create_template(
    name: str = Form(...),
    description: str = Form(""),
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
    service: TemplateService = Depends(get_service),
):
    return await service.create_template(
        user_id=user["id"],
        name=name,
        description=description,
        file=file,
    )


@router.get("", response_model=list[TemplateResponse])
async def list_templates(
    user: dict = Depends(get_current_user),
    service: TemplateService = Depends(get_service),
):
    return await service.list_templates()


@router.get("/{template_id}", response_model=TemplateResponse)
async def get_template(
    template_id: str,
    user: dict = Depends(get_current_user),
    service: TemplateService = Depends(get_service),
):
    return await service.get_template(template_id)


@router.patch("/{template_id}", response_model=TemplateResponse)
async def update_template(
    template_id: str,
    body: TemplateUpdate,
    user: dict = Depends(get_current_user),
    service: TemplateService = Depends(get_service),
):
    return await service.update_template(template_id, user["id"], body)


@router.delete("/{template_id}")
async def delete_template(
    template_id: str,
    user: dict = Depends(get_current_user),
    service: TemplateService = Depends(get_service),
):
    await service.delete_template(template_id, user["id"])
    return {"ok": True}


@router.get("/{template_id}/styles", response_model=TemplateStylesResponse)
async def get_template_styles(
    template_id: str,
    user: dict = Depends(get_current_user),
    service: TemplateService = Depends(get_service),
):
    return await service.get_template_styles(template_id)
