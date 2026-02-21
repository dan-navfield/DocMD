from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import (
    agent,
    audit,
    auth,
    conversions,
    documents,
    exports,
    mappings,
    projects,
    settings,
    templates,
)

app_settings = get_settings()

app = FastAPI(
    title=app_settings.app_name,
    description="Markdown to Word document conversion platform",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[app_settings.frontend_url],
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


@app.get("/health")
async def health():
    return {"status": "ok", "service": "docmd"}
