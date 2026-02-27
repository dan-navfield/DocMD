from __future__ import annotations

import hashlib
import logging
from urllib.parse import urlparse, urlunparse

import httpx
from jose import jwt
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import Response

from app.config import get_settings
from app.dependencies import get_current_user, get_supabase_admin
from app.services.template_service import TemplateService

logger = logging.getLogger(__name__)
router = APIRouter(tags=["onlyoffice"])


def get_service(supabase=Depends(get_supabase_admin)):
    return TemplateService(supabase)


def _sign_config(payload: dict, secret: str) -> str:
    """Sign an ONLYOFFICE config payload with HS256 JWT."""
    return jwt.encode(payload, secret, algorithm="HS256")


def _verify_onlyoffice_jwt(request: Request) -> dict:
    """Verify the JWT sent by ONLYOFFICE server in the Authorization header."""
    settings = get_settings()
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing ONLYOFFICE JWT")
    token = auth[len("Bearer "):]
    try:
        return jwt.decode(token, settings.onlyoffice_jwt_secret, algorithms=["HS256"])
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid ONLYOFFICE JWT")


def _make_document_key(template_id: str, version: int) -> str:
    """Generate a unique document key that changes per version (cache-busting)."""
    raw = f"{template_id}-v{version}"
    return hashlib.sha256(raw.encode()).hexdigest()[:20]


# ── Authenticated: frontend requests editor config ────────────────────


@router.get("/api/templates/{template_id}/onlyoffice-config")
async def get_onlyoffice_config(
    template_id: str,
    mode: str = "edit",
    user: dict = Depends(get_current_user),
    service: TemplateService = Depends(get_service),
):
    template = await service.get_template(template_id)
    settings = get_settings()

    filename = template["file_storage_path"].rsplit("/", 1)[-1]
    doc_key = _make_document_key(template_id, template["version"])
    base = settings.onlyoffice_callback_base_url

    is_view = mode == "view"

    config = {
        "document": {
            "fileType": "docx",
            "key": doc_key,
            "title": filename,
            "url": f"{base}/api/onlyoffice/download/{template_id}",
            "permissions": {
                "edit": not is_view,
                "download": True,
                "print": True,
            },
        },
        "editorConfig": {
            "mode": "view" if is_view else "edit",
            "lang": "en",
            "user": {
                "id": user["id"],
                "name": user.get("email", "User"),
            },
            "customization": {
                "autosave": not is_view,
                "forcesave": not is_view,
            },
        },
    }

    if is_view:
        config["type"] = "embedded"
    else:
        config["editorConfig"]["callbackUrl"] = (
            f"{base}/api/onlyoffice/callback?template_id={template_id}"
        )

    token = _sign_config(config, settings.onlyoffice_jwt_secret)
    config["token"] = token

    return {
        "config": config,
        "onlyoffice_url": settings.onlyoffice_url,
    }


# ── ONLYOFFICE calls: download the .docx file ────────────────────────


@router.get("/api/onlyoffice/download/{template_id}")
async def download_for_onlyoffice(
    template_id: str,
    request: Request,
    service: TemplateService = Depends(get_service),
):
    _verify_onlyoffice_jwt(request)
    file_bytes, filename = await service.download_template(template_id)

    return Response(
        content=file_bytes,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ── ONLYOFFICE calls: save callback ──────────────────────────────────


@router.post("/api/onlyoffice/callback")
async def onlyoffice_callback(
    request: Request,
    template_id: str = Query(...),
    service: TemplateService = Depends(get_service),
):
    body = await request.json()

    # Verify JWT in the request body (ONLYOFFICE sends token in body when JWT_IN_BODY=true)
    settings = get_settings()
    body_token = body.get("token")
    if body_token:
        try:
            jwt.decode(body_token, settings.onlyoffice_jwt_secret, algorithms=["HS256"])
        except Exception:
            raise HTTPException(status_code=401, detail="Invalid callback JWT")

    status = body.get("status")
    logger.info("ONLYOFFICE callback for template %s, status=%s", template_id, status)

    # Status 2 = document closed after editing, 6 = force save
    if status in (2, 6):
        doc_url = body.get("url")
        if not doc_url:
            logger.error("Callback status %s but no URL provided", status)
            return {"error": 0}

        # Rewrite ONLYOFFICE internal URL to be accessible from the host
        parsed = urlparse(doc_url)
        rewritten = urlunparse(parsed._replace(
            scheme="http",
            netloc=f"localhost:8080",
        ))
        logger.info("Downloading saved file from %s", rewritten)

        async with httpx.AsyncClient() as client:
            resp = await client.get(rewritten, timeout=30)
            if resp.status_code != 200:
                logger.error("Failed to download saved file: %s", resp.status_code)
                return {"error": 0}

        # Extract user ID from callback body (ONLYOFFICE provides the user list)
        users = body.get("users", [])
        user_id = users[0] if users else "system"

        await service.save_template_version(template_id, user_id, resp.content)
        logger.info("Template %s saved (version bumped)", template_id)

    return {"error": 0}
