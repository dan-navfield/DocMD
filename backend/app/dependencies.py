from __future__ import annotations

import hashlib
import logging
from typing import Optional

from fastapi import Depends, Header, HTTPException, status
from supabase import Client

from app.config import Settings, get_settings
from app.lib.supabase import create_client

logger = logging.getLogger(__name__)


def get_supabase_client(settings: Settings = Depends(get_settings)) -> Client:
    """Get a Supabase client using the anon key (respects RLS)."""
    return create_client(settings.supabase_url, settings.supabase_key)


def get_supabase_admin(settings: Settings = Depends(get_settings)) -> Client:
    """Get a Supabase client using the service key (bypasses RLS)."""
    return create_client(settings.supabase_url, settings.supabase_service_key)


async def get_current_user(
    authorization: Optional[str] = Header(None),
    supabase: Client = Depends(get_supabase_client),
    admin_client: Client = Depends(get_supabase_admin),
) -> dict:
    """
    Authenticate the current user via JWT token or API key.
    Returns user dict with at least 'id' field.
    """
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authorization header",
        )

    token = authorization.replace("Bearer ", "").strip()

    # Try JWT first (Supabase auth)
    try:
        user_response = supabase.auth.get_user(token)
        if user_response and user_response.user:
            return {
                "id": str(user_response.user.id),
                "email": user_response.user.email,
                "auth_type": "jwt",
            }
    except Exception:
        pass  # Not a valid JWT — try API key next

    # Try API key
    key_hash = hashlib.sha256(token.encode()).hexdigest()
    try:
        result = (
            admin_client.table("api_keys")
            .select("user_id")
            .eq("key_hash", key_hash)
            .single()
            .execute()
        )
        if result.data:
            # Update last_used_at
            admin_client.table("api_keys").update(
                {"last_used_at": "now()"}
            ).eq("key_hash", key_hash).execute()

            return {
                "id": result.data["user_id"],
                "email": None,
                "auth_type": "api_key",
            }
    except Exception:
        pass  # Not a valid API key

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid token or API key",
    )
