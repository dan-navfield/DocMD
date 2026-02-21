from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel


class ExportStatus(str, Enum):
    pending = "pending"
    exporting = "exporting"
    completed = "completed"
    failed = "failed"


class DestinationType(str, Enum):
    sharepoint = "sharepoint"
    local = "local"
    supabase = "supabase"


class DestinationCreate(BaseModel):
    name: str
    type: DestinationType
    config: dict = {}
    folder_rules: dict = {}


class DestinationUpdate(BaseModel):
    name: Optional[str] = None
    config: Optional[dict] = None
    folder_rules: Optional[dict] = None


class DestinationResponse(BaseModel):
    id: str
    project_id: str
    name: str
    type: DestinationType
    config: dict
    folder_rules: dict
    created_by: str
    created_at: datetime
    updated_at: datetime


class ExportCreate(BaseModel):
    destination_id: str


class ExportResponse(BaseModel):
    id: str
    conversion_id: str
    destination_id: str
    exported_path: Optional[str]
    status: ExportStatus
    error_message: Optional[str]
    exported_by: Optional[str]
    exported_at: datetime
