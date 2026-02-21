from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel


class LLMProvider(str, Enum):
    anthropic = "anthropic"
    openai = "openai"


class LLMSettingsUpdate(BaseModel):
    provider: LLMProvider
    api_key: str


class LLMSettingsResponse(BaseModel):
    provider: LLMProvider
    has_key: bool


class MicrosoftConnectionResponse(BaseModel):
    connected: bool
    email: Optional[str] = None


class ApiKeyCreate(BaseModel):
    name: str


class ApiKeyResponse(BaseModel):
    id: str
    name: str
    key_prefix: str
    last_used_at: Optional[str] = None
    created_at: str


class ApiKeyCreatedResponse(ApiKeyResponse):
    key: str  # Only returned on creation
