from __future__ import annotations

import re
from typing import Optional

import httpx
import msal

from app.config import Settings


class SharePointService:
    GRAPH_BASE = "https://graph.microsoft.com/v1.0"
    AUTHORITY = "https://login.microsoftonline.com"
    SCOPES = ["Sites.ReadWrite.All", "Files.ReadWrite.All"]

    def __init__(self, settings: Settings):
        self.settings = settings
        self.msal_app = msal.ConfidentialClientApplication(
            client_id=settings.microsoft_client_id,
            client_credential=settings.microsoft_client_secret,
            authority=f"{self.AUTHORITY}/{settings.microsoft_tenant_id}",
        )

    def get_auth_url(self) -> str:
        result = self.msal_app.get_authorization_request_url(
            scopes=self.SCOPES,
            redirect_uri=self.settings.microsoft_redirect_uri,
        )
        return result

    def exchange_code(self, code: str) -> dict:
        result = self.msal_app.acquire_token_by_authorization_code(
            code=code,
            scopes=self.SCOPES,
            redirect_uri=self.settings.microsoft_redirect_uri,
        )
        if "error" in result:
            raise ValueError(f"Token exchange failed: {result.get('error_description', result['error'])}")
        return {
            "access_token": result["access_token"],
            "refresh_token": result.get("refresh_token"),
            "expires_in": result.get("expires_in"),
        }

    def _get_access_token(self, tokens: dict) -> str:
        # Try to refresh if we have a refresh token
        if tokens.get("refresh_token"):
            result = self.msal_app.acquire_token_by_refresh_token(
                tokens["refresh_token"],
                scopes=self.SCOPES,
            )
            if "access_token" in result:
                return result["access_token"]
        return tokens.get("access_token", "")

    def resolve_folder_path(self, folder_rules: dict, document: dict) -> str:
        template = folder_rules.get("folder_template", "{doc_type}/")
        path = template.format(
            project_name=document.get("project_name", "default"),
            doc_type=document.get("doc_type", "general"),
            title=document.get("title", "untitled"),
            year=document.get("created_at", "")[:4],
            month=document.get("created_at", "")[5:7] if document.get("created_at") else "",
            author=document.get("metadata", {}).get("author", "unknown"),
        )
        # Clean up path
        path = re.sub(r"[^\w\-/.]", "-", path)
        path = re.sub(r"-+", "-", path)
        return path.strip("/")

    async def upload_file(
        self,
        tokens: dict,
        site_url: str,
        library_name: str,
        folder_path: str,
        filename: str,
        file_bytes: bytes,
    ) -> str:
        access_token = self._get_access_token(tokens)
        headers = {"Authorization": f"Bearer {access_token}"}

        async with httpx.AsyncClient() as client:
            # Get site ID
            site_resp = await client.get(
                f"{self.GRAPH_BASE}/sites/{site_url}",
                headers=headers,
            )
            site_resp.raise_for_status()
            site_id = site_resp.json()["id"]

            # Get drive ID for the document library
            drives_resp = await client.get(
                f"{self.GRAPH_BASE}/sites/{site_id}/drives",
                headers=headers,
            )
            drives_resp.raise_for_status()
            drive_id = None
            for drive in drives_resp.json().get("value", []):
                if drive["name"] == library_name:
                    drive_id = drive["id"]
                    break
            if not drive_id:
                raise ValueError(f"Document library '{library_name}' not found")

            # Create folders if needed
            await self._ensure_folders(client, headers, drive_id, folder_path)

            # Upload file
            full_path = f"{folder_path}/{filename}" if folder_path else filename
            upload_resp = await client.put(
                f"{self.GRAPH_BASE}/drives/{drive_id}/root:/{full_path}:/content",
                headers={**headers, "Content-Type": "application/octet-stream"},
                content=file_bytes,
            )
            upload_resp.raise_for_status()

            return f"{site_url}/{library_name}/{full_path}"

    async def _ensure_folders(
        self,
        client: httpx.AsyncClient,
        headers: dict,
        drive_id: str,
        folder_path: str,
    ):
        if not folder_path:
            return

        parts = folder_path.strip("/").split("/")
        current_path = ""

        for part in parts:
            parent = current_path if current_path else "root"
            parent_url = (
                f"{self.GRAPH_BASE}/drives/{drive_id}/root:/{current_path}:/children"
                if current_path
                else f"{self.GRAPH_BASE}/drives/{drive_id}/root/children"
            )

            try:
                await client.post(
                    parent_url,
                    headers={**headers, "Content-Type": "application/json"},
                    json={
                        "name": part,
                        "folder": {},
                        "@microsoft.graph.conflictBehavior": "fail",
                    },
                )
            except httpx.HTTPStatusError:
                pass  # Folder likely already exists

            current_path = f"{current_path}/{part}" if current_path else part
