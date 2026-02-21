from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from fastapi.responses import RedirectResponse

from app.config import Settings, get_settings
from app.dependencies import get_current_user, get_supabase_admin
from app.services.sharepoint_service import SharePointService

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.get("/microsoft")
async def microsoft_auth_start(
    settings: Settings = Depends(get_settings),
):
    """Initiate Microsoft OAuth flow for SharePoint access."""
    service = SharePointService(settings)
    auth_url = service.get_auth_url()
    return RedirectResponse(url=auth_url)


@router.get("/microsoft/callback")
async def microsoft_auth_callback(
    code: str,
    request: Request,
    settings: Settings = Depends(get_settings),
    supabase=Depends(get_supabase_admin),
    user: dict = Depends(get_current_user),
):
    """Handle Microsoft OAuth callback."""
    service = SharePointService(settings)
    tokens = service.exchange_code(code)

    # Store encrypted tokens for the user
    supabase.table("user_settings").upsert({
        "user_id": user["id"],
        "microsoft_tokens_encrypted": tokens,
    }).execute()

    return RedirectResponse(url=f"{settings.frontend_url}/settings?microsoft=connected")
