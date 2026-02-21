from __future__ import annotations

from typing import Optional


class AuditService:
    def __init__(self, supabase):
        self.supabase = supabase

    async def log(
        self,
        user_id: Optional[str],
        action: str,
        resource_type: str,
        resource_id: Optional[str] = None,
        details: Optional[dict] = None,
    ):
        self.supabase.table("audit_log").insert({
            "user_id": user_id,
            "action": action,
            "resource_type": resource_type,
            "resource_id": resource_id,
            "details": details or {},
        }).execute()
