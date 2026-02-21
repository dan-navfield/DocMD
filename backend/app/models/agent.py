from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel


class AgentMode(str, Enum):
    suggest = "suggest"
    auto = "auto"
    dry_run = "dry-run"


class ClassifyRequest(BaseModel):
    markdown: str
    project_id: Optional[str] = None
    mode: AgentMode = AgentMode.suggest


class ClassifyResponse(BaseModel):
    doc_type: str
    confidence: float
    recommended_template_id: Optional[str] = None
    recommended_mapping_id: Optional[str] = None
    recommended_folder: Optional[str] = None
    recommended_filename: Optional[str] = None
    actions_taken: list[dict] = []


class OrganizeRequest(BaseModel):
    project_id: str
    document_types: list[str] = []


class OrganizeResponse(BaseModel):
    proposed_structure: dict
    folders_to_create: list[str]
