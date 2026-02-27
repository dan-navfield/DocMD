from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel


class ConversionStatus(str, Enum):
    pending = "pending"
    processing = "processing"
    completed = "completed"
    failed = "failed"


class ConversionCreate(BaseModel):
    template_id: str
    mapping_id: str
    mapping_rules_override: Optional[dict] = None


class ConversionResponse(BaseModel):
    id: str
    document_id: str
    document_version_id: Optional[str]
    template_id: str
    mapping_id: str
    output_storage_path: Optional[str]
    warnings: list[str]
    conversion_report: dict
    status: ConversionStatus
    started_by: Optional[str]
    started_at: datetime
    completed_at: Optional[datetime]


class ConversionReport(BaseModel):
    document_id: str
    template_used: str
    mapping_used: str
    elements_processed: int = 0
    warnings: list[dict] = []
    stats: dict = {}
