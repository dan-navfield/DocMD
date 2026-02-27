from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, UploadFile
from fastapi.responses import Response

from app.dependencies import get_current_user, get_supabase_admin
from app.dependencies_billing import require_can_create_template
from app.models.template import TemplateResponse, TemplateStyleMapResponse, TemplateStylesResponse, TemplateUpdate
from app.services.template_service import TemplateService

router = APIRouter(prefix="/api/templates", tags=["templates"])


def get_service(supabase=Depends(get_supabase_admin)):
    return TemplateService(supabase)


@router.post("", response_model=TemplateResponse)
async def create_template(
    name: str = Form(...),
    description: str = Form(""),
    file: UploadFile = File(...),
    user: dict = Depends(require_can_create_template),
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


@router.get("/{template_id}/download")
async def download_template(
    template_id: str,
    user: dict = Depends(get_current_user),
    service: TemplateService = Depends(get_service),
):
    file_bytes, filename = await service.download_template(template_id)
    return Response(
        content=file_bytes,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{template_id}/preview")
async def preview_template(
    template_id: str,
    user: dict = Depends(get_current_user),
    service: TemplateService = Depends(get_service),
):
    pdf_bytes = await service.get_template_preview_pdf(template_id)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
    )


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


@router.get("/{template_id}/style-map", response_model=TemplateStyleMapResponse)
async def get_template_style_map(
    template_id: str,
    user: dict = Depends(get_current_user),
    service: TemplateService = Depends(get_service),
):
    return await service.get_style_map(template_id)
