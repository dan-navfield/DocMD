from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


# ── Request models ──


class ConvertRequest(BaseModel):
    markdown: str = Field(..., min_length=1, description="Raw markdown text")
    template_id: str = Field(..., description="UUID of the template to use")
    mapping_id: str = Field(..., description="UUID of the style mapping to use")
    filename: str = Field(default="document", description="Output filename without extension")
    response_format: str = Field(
        default="binary",
        pattern="^(binary|json)$",
        description="'binary' returns DOCX bytes, 'json' returns metadata + download URL",
    )


# ── Response models ──


class ConvertResponseJSON(BaseModel):
    conversion_id: str
    status: str
    filename: str
    download_url: str
    warnings: list[str] = []
    stats: dict = {}
    created_at: datetime


class TemplateListItem(BaseModel):
    id: str
    name: str
    description: str = ""
    created_at: datetime


class MappingListItem(BaseModel):
    id: str
    name: str
    template_id: Optional[str] = None
    is_default: bool = False
    created_at: datetime


class ConversionStatusResponse(BaseModel):
    id: str
    status: str
    document_id: str
    template_id: str
    mapping_id: str
    filename: str
    warnings: list[str] = []
    stats: dict = {}
    created_at: datetime
    completed_at: Optional[datetime] = None


# ── Error envelope ──


class APIErrorDetail(BaseModel):
    code: str
    message: str


class APIErrorResponse(BaseModel):
    error: APIErrorDetail
