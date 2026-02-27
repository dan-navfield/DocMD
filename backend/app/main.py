import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.routers import (
    agent,
    audit,
    auth,
    billing,
    conversions,
    documents,
    exports,
    fonts,
    mappings,
    mcp_auth,
    onboarding,
    onlyoffice,
    projects,
    public_api,
    settings,
    templates,
)

logger = logging.getLogger(__name__)

app_settings = get_settings()

app = FastAPI(
    title=app_settings.app_name,
    description="Markdown to Word document conversion platform",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[app_settings.frontend_url, "http://localhost:3001", app_settings.onlyoffice_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register all routers
app.include_router(documents.router)
app.include_router(conversions.router)
app.include_router(exports.router)
app.include_router(templates.router)
app.include_router(mappings.router)
app.include_router(projects.router)
app.include_router(agent.router)
app.include_router(settings.router)
app.include_router(auth.router)
app.include_router(audit.router)
app.include_router(onboarding.router)
app.include_router(onlyoffice.router)
app.include_router(fonts.router)
app.include_router(billing.router)
app.include_router(mcp_auth.router)
app.include_router(public_api.router)


# ── Error envelope for /api/v1/ paths ──


def _is_v1_path(url_path: str) -> bool:
    return url_path.startswith("/api/v1/") or url_path == "/api/v1"


@app.exception_handler(StarletteHTTPException)
async def v1_http_exception_handler(request, exc):
    if _is_v1_path(request.url.path):
        # If detail is already structured (from require_api_key), use it directly
        if isinstance(exc.detail, dict) and "code" in exc.detail:
            return JSONResponse(
                status_code=exc.status_code,
                content={"error": exc.detail},
            )
        # Map status codes to error codes for unstructured errors
        code_map = {
            401: "invalid_api_key",
            403: "api_access_denied",
            404: "not_found",
            422: "validation_error",
            429: "rate_limit_exceeded",
            500: "internal_error",
        }
        code = code_map.get(exc.status_code, "internal_error")
        message = exc.detail if isinstance(exc.detail, str) else str(exc.detail)
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": {"code": code, "message": message}},
        )
    # Non-v1 paths: default behaviour
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


@app.exception_handler(RequestValidationError)
async def v1_validation_exception_handler(request, exc):
    if _is_v1_path(request.url.path):
        return JSONResponse(
            status_code=422,
            content={"error": {"code": "validation_error", "message": str(exc)}},
        )
    # Non-v1: default FastAPI validation response
    return JSONResponse(status_code=422, content={"detail": exc.errors()})


@app.on_event("startup")
async def startup_sync_fonts():
    """Sync fonts from Supabase Storage to local disk on startup."""
    import asyncio
    try:
        from app.lib.supabase import create_client

        s = get_settings()
        supabase = create_client(s.supabase_url, s.supabase_service_key)
        from app.services.font_service import FontService

        service = FontService(supabase)
        await asyncio.wait_for(service.sync_fonts_from_storage(), timeout=15)
        await asyncio.wait_for(service.refresh_font_families(), timeout=15)
    except asyncio.TimeoutError:
        logger.warning("Font sync on startup timed out")
    except Exception as e:
        logger.warning("Font sync on startup failed: %s", e)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "docmd"}
