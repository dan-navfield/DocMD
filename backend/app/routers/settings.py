from __future__ import annotations

from fastapi import APIRouter, Depends

from app.dependencies import get_current_user, get_supabase_admin
from app.models.settings import (
    ApiKeyCreate,
    ApiKeyCreatedResponse,
    ApiKeyResponse,
    LLMSettingsResponse,
    LLMSettingsUpdate,
    MicrosoftConnectionResponse,
)
from app.services.settings_service import SettingsService

router = APIRouter(prefix="/api/settings", tags=["settings"])


def get_service(supabase=Depends(get_supabase_admin)):
    return SettingsService(supabase)


# LLM Settings
@router.get("/llm", response_model=LLMSettingsResponse)
async def get_llm_settings(
    user: dict = Depends(get_current_user),
    service: SettingsService = Depends(get_service),
):
    return await service.get_llm_settings(user["id"])


@router.put("/llm", response_model=LLMSettingsResponse)
async def update_llm_settings(
    body: LLMSettingsUpdate,
    user: dict = Depends(get_current_user),
    service: SettingsService = Depends(get_service),
):
    return await service.update_llm_settings(user["id"], body)


# Microsoft Connection
@router.get("/microsoft", response_model=MicrosoftConnectionResponse)
async def get_microsoft_connection(
    user: dict = Depends(get_current_user),
    service: SettingsService = Depends(get_service),
):
    return await service.get_microsoft_connection(user["id"])


# API Keys
@router.post("/api-keys", response_model=ApiKeyCreatedResponse)
async def create_api_key(
    body: ApiKeyCreate,
    user: dict = Depends(get_current_user),
    service: SettingsService = Depends(get_service),
):
    return await service.create_api_key(user["id"], body.name)


@router.get("/api-keys", response_model=list[ApiKeyResponse])
async def list_api_keys(
    user: dict = Depends(get_current_user),
    service: SettingsService = Depends(get_service),
):
    return await service.list_api_keys(user["id"])


@router.delete("/api-keys/{key_id}")
async def delete_api_key(
    key_id: str,
    user: dict = Depends(get_current_user),
    service: SettingsService = Depends(get_service),
):
    await service.delete_api_key(key_id, user["id"])
    return {"ok": True}
