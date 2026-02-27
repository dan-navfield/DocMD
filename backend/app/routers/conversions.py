from __future__ import annotations

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from app.config import Settings, get_settings
from app.dependencies import get_current_user, get_supabase_admin
from app.dependencies_billing import require_can_convert
from app.models.conversion import ConversionCreate, ConversionResponse
from app.services.billing_service import BillingService
from app.services.conversion_service import ConversionService

router = APIRouter(prefix="/api", tags=["conversions"])


def get_service(supabase=Depends(get_supabase_admin)):
    return ConversionService(supabase)


@router.post("/documents/{document_id}/convert", response_model=ConversionResponse)
async def convert_document(
    document_id: str,
    body: ConversionCreate,
    user: dict = Depends(require_can_convert),
    service: ConversionService = Depends(get_service),
    supabase=Depends(get_supabase_admin),
    settings: Settings = Depends(get_settings),
):
    result = await service.convert_document(
        document_id=document_id,
        template_id=body.template_id,
        mapping_id=body.mapping_id,
        user_id=user["id"],
        mapping_rules_override=body.mapping_rules_override,
    )
    # Increment conversion counter after successful conversion
    billing = BillingService(supabase, settings)
    billing.increment_conversion_count(user["id"])
    return result


@router.get("/conversions/{conversion_id}", response_model=ConversionResponse)
async def get_conversion(
    conversion_id: str,
    user: dict = Depends(get_current_user),
    service: ConversionService = Depends(get_service),
):
    return await service.get_conversion(conversion_id, user["id"])


@router.get("/conversions/{conversion_id}/download")
async def download_conversion(
    conversion_id: str,
    user: dict = Depends(get_current_user),
    service: ConversionService = Depends(get_service),
):
    file_data, filename = await service.download_conversion(conversion_id, user["id"])
    return StreamingResponse(
        file_data,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
