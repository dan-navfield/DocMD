from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class HeadingMapping(BaseModel):
    h1: str = "Heading 1"
    h2: str = "Heading 2"
    h3: str = "Heading 3"
    h4: str = "Heading 4"
    h5: str = "Heading 5"
    h6: str = "Heading 6"


class TableMapping(BaseModel):
    style: str = "Grid Table 1 Light"
    header_row: bool = True


class MappingRules(BaseModel):
    heading: HeadingMapping = Field(default_factory=HeadingMapping)
    paragraph: str = "Normal"
    list_bullet: str = "List Bullet"
    list_bullet_2: str = "List Bullet 2"
    list_bullet_3: str = "List Bullet 3"
    list_ordered: str = "List Number"
    list_ordered_2: str = "List Number 2"
    list_ordered_3: str = "List Number 3"
    code_block: str = "Code"
    blockquote: str = "Quote"
    table: TableMapping = Field(default_factory=TableMapping)
    page_break_before: list[str] = Field(default_factory=list)
    metadata_mapping: dict[str, str] = Field(default_factory=dict)


class MappingCreate(BaseModel):
    name: str
    template_id: Optional[str] = None
    rules: MappingRules = Field(default_factory=MappingRules)
    is_default: bool = False


class MappingUpdate(BaseModel):
    name: Optional[str] = None
    template_id: Optional[str] = None
    rules: Optional[MappingRules] = None
    is_default: Optional[bool] = None


class MappingResponse(BaseModel):
    id: str
    name: str
    version: int
    template_id: Optional[str]
    rules: dict
    is_default: bool
    created_by: str
    created_at: datetime
    updated_at: datetime
