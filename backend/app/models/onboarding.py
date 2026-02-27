from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class OnboardingStatusResponse(BaseModel):
    completed: bool
    completed_at: Optional[datetime] = None


class SeedMappingRequest(BaseModel):
    template_id: Optional[str] = None
    name: str = "Default Mapping"


class SeedMappingResponse(BaseModel):
    mapping_id: str
    mapping: dict
