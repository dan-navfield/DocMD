from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class TemplateCreate(BaseModel):
    name: str
    description: str = ""


class TemplateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class TemplateResponse(BaseModel):
    id: str
    name: str
    description: str
    file_storage_path: str
    version: int
    created_by: str
    created_at: datetime
    updated_at: datetime


class TemplateStylesResponse(BaseModel):
    template_id: str
    styles: list[str]
    used_styles: list[str] = []


class StyleMapEntry(BaseModel):
    index: int
    text: str
    style: str


class TemplateStyleMapResponse(BaseModel):
    template_id: str
    paragraphs: list[StyleMapEntry]
