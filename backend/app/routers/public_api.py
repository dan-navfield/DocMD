from __future__ import annotations

import io
from typing import Optional

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response, StreamingResponse

from app.config import Settings, get_settings
from app.dependencies import get_supabase_admin
from app.dependencies_billing import get_billing_service, require_api_key
from app.models.public_api import (
    ConversionStatusResponse,
    ConvertRequest,
    ConvertResponseJSON,
    MappingListItem,
    TemplateListItem,
)
from app.services.billing_service import BillingService
from app.services.conversion_service import ConversionService

router = APIRouter(prefix="/api/v1", tags=["public-api"])

DOCX_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"


def _get_service(supabase=Depends(get_supabase_admin)):
    return ConversionService(supabase)


# ── POST /api/v1/convert ──


@router.post("/convert")
async def convert(
    body: ConvertRequest,
    user: dict = Depends(require_api_key),
    service: ConversionService = Depends(_get_service),
    billing: BillingService = Depends(get_billing_service),
):
    result = await service.convert_markdown_direct(
        markdown_text=body.markdown,
        template_id=body.template_id,
        mapping_id=body.mapping_id,
        user_id=user["id"],
        filename=body.filename,
    )

    # Increment billing counter after success
    billing.increment_conversion_count(user["id"])

    warnings = result.get("warnings", [])
    warnings_header = "; ".join(warnings) if warnings else ""

    if body.response_format == "json":
        return ConvertResponseJSON(
            conversion_id=result["conversion_id"],
            status="completed",
            filename=f"{body.filename}.docx",
            download_url=f"/api/v1/conversions/{result['conversion_id']}/download",
            warnings=warnings,
            stats=result.get("stats", {}),
            created_at=result["created_at"],
        )

    # Default: binary response
    headers = {
        "Content-Disposition": f'attachment; filename="{body.filename}.docx"',
        "X-Conversion-Id": result["conversion_id"],
    }
    if warnings_header:
        headers["X-Warnings"] = warnings_header

    return Response(
        content=result["docx_bytes"],
        media_type=DOCX_MEDIA_TYPE,
        headers=headers,
    )


# ── GET /api/v1/conversions/{id} ──


@router.get("/conversions/{conversion_id}", response_model=ConversionStatusResponse)
async def get_conversion(
    conversion_id: str,
    user: dict = Depends(require_api_key),
    service: ConversionService = Depends(_get_service),
):
    data = await service.get_conversion(conversion_id, user["id"])

    # Resolve filename from document record
    supabase = service.supabase
    doc = supabase.table("documents").select("title").eq("id", data["document_id"]).single().execute()
    filename = doc.data["title"] if doc.data else "document"

    return ConversionStatusResponse(
        id=data["id"],
        status=data["status"],
        document_id=data["document_id"],
        template_id=data["template_id"],
        mapping_id=data["mapping_id"],
        filename=f"{filename}.docx",
        warnings=data.get("warnings", []),
        stats=data.get("conversion_report", {}).get("stats", {}),
        created_at=data["started_at"],
        completed_at=data.get("completed_at"),
    )


# ── GET /api/v1/conversions/{id}/download ──


@router.get("/conversions/{conversion_id}/download")
async def download_conversion(
    conversion_id: str,
    user: dict = Depends(require_api_key),
    service: ConversionService = Depends(_get_service),
):
    file_data, filename = await service.download_conversion(conversion_id, user["id"])
    return StreamingResponse(
        file_data,
        media_type=DOCX_MEDIA_TYPE,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ── GET /api/v1/templates ──


@router.get("/templates", response_model=list[TemplateListItem])
async def list_templates(
    user: dict = Depends(require_api_key),
    supabase=Depends(get_supabase_admin),
):
    result = (
        supabase.table("templates")
        .select("id, name, description, created_at")
        .eq("created_by", user["id"])
        .order("created_at", desc=True)
        .execute()
    )
    return [TemplateListItem(**row) for row in (result.data or [])]


# ── GET /api/v1/mappings ──


@router.get("/mappings", response_model=list[MappingListItem])
async def list_mappings(
    template_id: Optional[str] = Query(None, description="Filter by template UUID"),
    user: dict = Depends(require_api_key),
    supabase=Depends(get_supabase_admin),
):
    query = (
        supabase.table("mappings")
        .select("id, name, template_id, is_default, created_at")
        .eq("created_by", user["id"])
    )
    if template_id:
        query = query.eq("template_id", template_id)
    result = query.order("created_at", desc=True).execute()
    return [MappingListItem(**row) for row in (result.data or [])]
