from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends

from app.dependencies import get_current_user, get_supabase_admin

router = APIRouter(prefix="/api/audit-log", tags=["audit"])


@router.get("")
async def get_audit_log(
    resource_type: Optional[str] = None,
    resource_id: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    user: dict = Depends(get_current_user),
    supabase=Depends(get_supabase_admin),
):
    query = supabase.table("audit_log").select("*").eq("user_id", user["id"])

    if resource_type:
        query = query.eq("resource_type", resource_type)
    if resource_id:
        query = query.eq("resource_id", resource_id)

    result = query.order("created_at", desc=True).range(offset, offset + limit - 1).execute()
    return result.data
