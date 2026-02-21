from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class ProjectRole(str, Enum):
    owner = "owner"
    editor = "editor"
    viewer = "viewer"


class NamingRules(BaseModel):
    folder_template: str = "{project_name}/{doc_type}/"
    filename_template: str = "{doc_type}-{title}"
    date_format: str = "%Y-%m"
    lowercase: bool = True
    separator: str = "-"


class ProjectCreate(BaseModel):
    name: str
    description: str = ""
    naming_rules: NamingRules = Field(default_factory=NamingRules)


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    default_template_id: Optional[str] = None
    default_mapping_id: Optional[str] = None
    default_destination_id: Optional[str] = None
    naming_rules: Optional[NamingRules] = None


class ProjectResponse(BaseModel):
    id: str
    name: str
    description: str
    default_template_id: Optional[str]
    default_mapping_id: Optional[str]
    default_destination_id: Optional[str]
    naming_rules: dict
    owner_id: str
    created_at: datetime
    updated_at: datetime


class ProjectMemberCreate(BaseModel):
    user_id: str
    role: ProjectRole = ProjectRole.viewer


class ProjectMemberResponse(BaseModel):
    project_id: str
    user_id: str
    role: ProjectRole
    created_at: datetime
