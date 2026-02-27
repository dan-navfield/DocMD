"""Patched Supabase client creation that supports new-style API keys.

supabase-py 2.x validates keys as JWT (eyJ...) format. Newer Supabase projects
use sb_publishable_ / sb_secret_ keys which fail that check. This module
monkey-patches the validation to accept both formats.
"""
from __future__ import annotations

import re

from supabase import Client
from supabase._sync.client import (
    ClientOptions,
    SupabaseException,
    SyncClient,
    SyncMemoryStorage,
)

_ORIGINAL_INIT = SyncClient.__init__


def _patched_init(
    self,
    supabase_url: str,
    supabase_key: str,
    options=None,
):
    if not supabase_url:
        raise SupabaseException("supabase_url is required")
    if not supabase_key:
        raise SupabaseException("supabase_key is required")
    if not re.match(r"^(https?)://.+", supabase_url):
        raise SupabaseException("Invalid URL")

    # Accept both old JWT keys and new sb_publishable_ / sb_secret_ keys
    is_jwt = re.match(
        r"^[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*$",
        supabase_key,
    )
    is_new_format = supabase_key.startswith(("sb_publishable_", "sb_secret_"))
    if not is_jwt and not is_new_format:
        raise SupabaseException("Invalid API key")

    if options is None:
        options = ClientOptions(storage=SyncMemoryStorage())

    self.supabase_url = supabase_url
    self.supabase_key = supabase_key
    self.options = options
    options.headers.update(self._get_auth_headers())
    self.rest_url = f"{supabase_url}/rest/v1"
    self.realtime_url = f"{supabase_url}/realtime/v1".replace("http", "ws")
    self.auth_url = f"{supabase_url}/auth/v1"
    self.storage_url = f"{supabase_url}/storage/v1"
    self.functions_url = f"{supabase_url}/functions/v1"

    self.auth = self._init_supabase_auth_client(
        auth_url=self.auth_url,
        client_options=options,
    )
    self.realtime = self._init_realtime_client(
        realtime_url=self.realtime_url,
        supabase_key=self.supabase_key,
        options=options.realtime if options else None,
    )
    self._postgrest = None
    self._storage = None
    self._functions = None
    self.auth.on_auth_state_change(self._listen_to_auth_events)


# Apply the patch
SyncClient.__init__ = _patched_init  # type: ignore[assignment]


def create_client(url: str, key: str) -> Client:
    """Create a Supabase client that accepts both JWT and new-style keys."""
    return SyncClient(url, key)  # type: ignore[return-value]
