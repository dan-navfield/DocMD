from __future__ import annotations

import hashlib
from typing import Optional

from fastapi import Depends, Header, HTTPException, status

from app.config import Settings, get_settings
from app.dependencies import get_current_user, get_supabase_admin
from app.services.billing_service import BillingService


def get_billing_service(
    supabase=Depends(get_supabase_admin),
    settings: Settings = Depends(get_settings),
) -> BillingService:
    return BillingService(supabase, settings)


async def require_can_convert(
    user: dict = Depends(get_current_user),
    service: BillingService = Depends(get_billing_service),
) -> dict:
    """Dependency that checks the user can perform a conversion.
    Returns the user dict if allowed, raises 403 otherwise."""
    allowed, message = service.check_can_convert(user["id"])
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=message,
        )
    return user


async def require_api_key(
    authorization: Optional[str] = Header(None),
    supabase=Depends(get_supabase_admin),
    settings: Settings = Depends(get_settings),
) -> dict:
    """Dependency for public API endpoints: API-key-only auth with billing gates.

    1. Requires ``Authorization: Bearer docmd_...`` — rejects JWT tokens.
    2. Validates key via SHA-256 hash lookup in ``api_keys`` table.
    3. Checks ``api_access`` feature gate (team/enterprise only).
    4. Checks ``can_convert`` billing quota.
    5. Updates ``last_used_at`` on the key.
    """
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "missing_api_key", "message": "Missing Authorization header. Use: Bearer docmd_..."},
        )

    token = authorization.replace("Bearer ", "").strip()

    # Reject non-API-key tokens (JWTs, random strings without docmd_ prefix)
    if not token.startswith("docmd_"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "invalid_api_key", "message": "This endpoint requires an API key (docmd_...). JWT tokens are not accepted."},
        )

    # Validate key via SHA-256 hash
    key_hash = hashlib.sha256(token.encode()).hexdigest()
    try:
        result = (
            supabase.table("api_keys")
            .select("user_id, id")
            .eq("key_hash", key_hash)
            .single()
            .execute()
        )
        if not result.data:
            raise ValueError("no match")
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "invalid_api_key", "message": "Invalid or revoked API key."},
        )

    user_id = result.data["user_id"]
    key_id = result.data["id"]

    # Update last_used_at
    supabase.table("api_keys").update({"last_used_at": "now()"}).eq("id", key_id).execute()

    # Check api_access feature gate
    billing = BillingService(supabase, settings)
    has_access, access_msg = billing.check_feature_access(user_id, "api_access")
    if not has_access:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "api_access_denied", "message": access_msg},
        )

    # Check conversion quota
    can_convert, convert_msg = billing.check_can_convert(user_id)
    if not can_convert:
        raise HTTPException(
            status_code=429,
            detail={"code": "rate_limit_exceeded", "message": convert_msg},
        )

    return {"id": user_id, "auth_type": "api_key", "api_key_id": key_id}


async def require_mcp_key(
    authorization: Optional[str] = Header(None),
    supabase=Depends(get_supabase_admin),
    settings: Settings = Depends(get_settings),
) -> dict:
    """Dependency for MCP server endpoints: API-key auth with mcp_server_access gate.

    Same auth flow as ``require_api_key`` but checks the ``mcp_server_access``
    feature (available on all tiers) instead of ``api_access`` (team/enterprise).
    Also verifies the subscription is in good standing.
    """
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header",
        )

    token = authorization.replace("Bearer ", "").strip()

    if not token.startswith("docmd_"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="This endpoint requires a DocMD API key (docmd_...).",
        )

    key_hash = hashlib.sha256(token.encode()).hexdigest()
    try:
        result = (
            supabase.table("api_keys")
            .select("user_id, id")
            .eq("key_hash", key_hash)
            .single()
            .execute()
        )
        if not result.data:
            raise ValueError("no match")
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or revoked API key.",
        )

    user_id = result.data["user_id"]
    key_id = result.data["id"]

    # Update last_used_at
    supabase.table("api_keys").update({"last_used_at": "now()"}).eq("id", key_id).execute()

    # Check mcp_server_access feature gate
    billing = BillingService(supabase, settings)
    has_access, access_msg = billing.check_feature_access(user_id, "mcp_server_access")
    if not has_access:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=access_msg,
        )

    # Check subscription is in good standing (not expired/canceled)
    can_convert, convert_msg = billing.check_can_convert(user_id)
    if not can_convert:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=convert_msg,
        )

    return {"id": user_id, "auth_type": "api_key", "api_key_id": key_id}


async def require_can_create_template(
    user: dict = Depends(get_current_user),
    service: BillingService = Depends(get_billing_service),
) -> dict:
    """Dependency that checks the user can create a template.
    Returns the user dict if allowed, raises 403 otherwise."""
    allowed, message = service.check_can_create_template(user["id"])
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=message,
        )
    return user
