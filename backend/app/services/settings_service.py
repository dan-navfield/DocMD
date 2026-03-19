from __future__ import annotations

import hashlib
import secrets

from fastapi import HTTPException

from app.models.settings import LLMSettingsUpdate


class SettingsService:
    def __init__(self, supabase):
        self.supabase = supabase

    async def get_llm_settings(self, user_id: str) -> dict:
        result = (
            self.supabase.table("user_settings")
            .select("llm_provider, llm_api_key_encrypted")
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )
        if not result.data:
            return {"provider": "anthropic", "has_key": False}
        return {
            "provider": result.data.get("llm_provider", "anthropic"),
            "has_key": bool(result.data.get("llm_api_key_encrypted")),
        }

    async def update_llm_settings(self, user_id: str, body: LLMSettingsUpdate) -> dict:
        self.supabase.table("user_settings").upsert({
            "user_id": user_id,
            "llm_provider": body.provider.value,
            "llm_api_key_encrypted": body.api_key,  # TODO: encrypt before storing
        }).execute()
        return {"provider": body.provider, "has_key": True}

    async def get_microsoft_connection(self, user_id: str) -> dict:
        result = (
            self.supabase.table("user_settings")
            .select("microsoft_tokens_encrypted")
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )
        if not result.data or not result.data.get("microsoft_tokens_encrypted"):
            return {"connected": False, "email": None}
        return {"connected": True, "email": None}

    async def create_api_key(self, user_id: str, name: str) -> dict:
        raw_key = f"mddoc_{secrets.token_urlsafe(32)}"
        key_hash = hashlib.sha256(raw_key.encode()).hexdigest()

        result = self.supabase.table("api_keys").insert({
            "user_id": user_id,
            "key_hash": key_hash,
            "name": name,
        }).execute()

        data = result.data[0]
        return {
            "id": data["id"],
            "name": data["name"],
            "key_prefix": raw_key[:12] + "...",
            "key": raw_key,
            "last_used_at": data.get("last_used_at"),
            "created_at": data["created_at"],
        }

    async def list_api_keys(self, user_id: str) -> list[dict]:
        result = (
            self.supabase.table("api_keys")
            .select("id, name, last_used_at, created_at")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .execute()
        )
        return [
            {
                **row,
                "key_prefix": "mddoc_***",
            }
            for row in result.data
        ]

    async def delete_api_key(self, key_id: str, user_id: str):
        result = (
            self.supabase.table("api_keys")
            .delete()
            .eq("id", key_id)
            .eq("user_id", user_id)
            .execute()
        )
        if not result.data:
            raise HTTPException(status_code=404, detail="API key not found")
