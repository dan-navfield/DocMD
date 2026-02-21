from __future__ import annotations

from fastapi import APIRouter, Depends

from app.dependencies import get_current_user, get_supabase_admin
from app.models.agent import (
    ClassifyRequest,
    ClassifyResponse,
    OrganizeRequest,
    OrganizeResponse,
)
from app.services.agent_service import AgentService

router = APIRouter(prefix="/api/agent", tags=["agent"])


def get_service(supabase=Depends(get_supabase_admin)):
    return AgentService(supabase)


@router.post("/classify", response_model=ClassifyResponse)
async def classify_document(
    body: ClassifyRequest,
    user: dict = Depends(get_current_user),
    service: AgentService = Depends(get_service),
):
    return await service.classify(
        markdown=body.markdown,
        project_id=body.project_id,
        mode=body.mode,
        user_id=user["id"],
    )


@router.post("/organize", response_model=OrganizeResponse)
async def organize_project(
    body: OrganizeRequest,
    user: dict = Depends(get_current_user),
    service: AgentService = Depends(get_service),
):
    return await service.organize(
        project_id=body.project_id,
        document_types=body.document_types,
        user_id=user["id"],
    )
