from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class DocumentStatus(str, Enum):
    received = "received"
    converted = "converted"
    exported = "exported"


class DocumentMetadata(BaseModel):
    title: Optional[str] = None
    system: Optional[str] = None
    version: Optional[str] = None
    classification: Optional[str] = None
    author: Optional[str] = None


class DocumentCreate(BaseModel):
    title: str
    project_id: Optional[str] = None
    doc_type: Optional[str] = ""
    tags: list[str] = Field(default_factory=list)
    metadata: DocumentMetadata = Field(default_factory=DocumentMetadata)


class DocumentUpdate(BaseModel):
    title: Optional[str] = None
    project_id: Optional[str] = None
    doc_type: Optional[str] = None
    tags: Optional[list[str]] = None
    metadata: Optional[DocumentMetadata] = None


class DocumentResponse(BaseModel):
    id: str
    project_id: Optional[str]
    title: str
    doc_type: str
    status: DocumentStatus
    tags: list[str]
    metadata: dict
    markdown_storage_path: str
    current_version: int
    created_by: str
    created_at: datetime
    updated_at: datetime


class DocumentVersionResponse(BaseModel):
    id: str
    document_id: str
    version_number: int
    markdown_storage_path: str
    created_by: str
    created_at: datetime


class DocumentListParams(BaseModel):
    project_id: Optional[str] = None
    status: Optional[DocumentStatus] = None
    doc_type: Optional[str] = None
    tags: Optional[list[str]] = None
    search: Optional[str] = None
    offset: int = 0
    limit: int = 50
