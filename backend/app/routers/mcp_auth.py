from __future__ import annotations

from fastapi import APIRouter, Depends

from app.dependencies_billing import require_mcp_key

router = APIRouter(prefix="/api/mcp", tags=["mcp"])


@router.get("/validate")
async def validate_mcp_key(user: dict = Depends(require_mcp_key)):
    """Validate an API key for MCP server access.

    Returns the user id if the key is valid, the subscription is in good
    standing, and the ``mcp_server_access`` feature is enabled.
    """
    return {"ok": True, "user_id": user["id"]}
