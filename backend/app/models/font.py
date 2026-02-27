from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class FontResponse(BaseModel):
    id: str
    name: str
    family: str
    font_aliases: list[str] = []
    filename: str
    file_storage_path: str
    file_size_bytes: int
    mime_type: str
    created_by: str
    created_at: datetime


class FontUploadResponse(BaseModel):
    fonts: list[FontResponse]
    onlyoffice_refreshed: bool
