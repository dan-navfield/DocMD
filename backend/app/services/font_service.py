from __future__ import annotations

import io
import logging
import os
import subprocess
import uuid
import zipfile

from fastapi import HTTPException, UploadFile

from app.config import get_settings

logger = logging.getLogger(__name__)

ALLOWED_EXTENSIONS = {".ttf", ".otf", ".woff", ".woff2"}


def _extract_font_family(data: bytes, fallback: str) -> str:
    """Extract the real font family name (nameID 1) from font binary data."""
    try:
        from fontTools.ttLib import TTFont
        font = TTFont(io.BytesIO(data))
        name_table = font["name"]
        family = name_table.getDebugName(1)
        font.close()
        return family or fallback
    except Exception:
        return fallback


def _extract_font_aliases(data: bytes, fallback: str) -> list[str]:
    """Extract all name variants a DOCX might use to reference this font.

    Returns a deduplicated list of names from nameID 1 (family), 4 (full name),
    and 16 (typographic family).
    """
    try:
        from fontTools.ttLib import TTFont
        font = TTFont(io.BytesIO(data))
        nt = font["name"]
        names = set()
        for name_id in (1, 4, 6, 16):
            val = nt.getDebugName(name_id)
            if val:
                names.add(val)
        font.close()
        return sorted(names) if names else [fallback]
    except Exception:
        return [fallback]


MIME_MAP = {
    ".ttf": "font/ttf",
    ".otf": "font/otf",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
}


class FontService:
    def __init__(self, supabase):
        self.supabase = supabase
        self.settings = get_settings()

    async def upload_fonts(
        self, user_id: str, files: list[UploadFile]
    ) -> dict:
        fonts_dir = self.settings.fonts_dir
        os.makedirs(fonts_dir, exist_ok=True)

        # Flatten uploads: extract font files from zips, pass others through
        font_files: list[tuple[str, bytes]] = []  # (filename, content)
        for file in files:
            filename = file.filename or "unknown"
            ext = os.path.splitext(filename)[1].lower()
            content = await file.read()

            if ext == ".zip":
                extracted = _extract_fonts_from_zip(content)
                if not extracted:
                    raise HTTPException(
                        status_code=400,
                        detail=f"No font files found in {filename}",
                    )
                font_files.extend(extracted)
            elif ext in ALLOWED_EXTENSIONS:
                font_files.append((filename, content))
            else:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid file type: {ext}. Allowed: {', '.join(ALLOWED_EXTENSIONS)}, .zip",
                )

        uploaded = []
        for filename, content in font_files:
            ext = os.path.splitext(filename)[1].lower()
            font_id = str(uuid.uuid4())
            storage_path = f"{user_id}/{font_id}/{filename}"
            name = os.path.splitext(filename)[0]
            mime = MIME_MAP.get(ext, "application/octet-stream")

            # Upload to Supabase Storage
            self.supabase.storage.from_("fonts").upload(
                storage_path, content, {"content-type": mime}
            )

            # Write to local fonts directory
            local_path = os.path.join(fonts_dir, filename)
            with open(local_path, "wb") as f:
                f.write(content)

            # Extract real font family name and all aliases from the binary data
            family = _extract_font_family(content, name)
            aliases = _extract_font_aliases(content, name)

            # Insert DB row
            result = (
                self.supabase.table("fonts")
                .insert(
                    {
                        "id": font_id,
                        "name": name,
                        "family": family,
                        "font_aliases": aliases,
                        "filename": filename,
                        "file_storage_path": storage_path,
                        "file_size_bytes": len(content),
                        "mime_type": mime,
                        "created_by": user_id,
                    }
                )
                .execute()
            )
            uploaded.append(result.data[0])

        # Refresh font caches
        oo_ok = _refresh_onlyoffice_fonts(self.settings.onlyoffice_container_name)
        _refresh_fontconfig()

        return {"fonts": uploaded, "onlyoffice_refreshed": oo_ok}

    async def get_font(self, font_id: str) -> dict:
        result = (
            self.supabase.table("fonts")
            .select("*")
            .eq("id", font_id)
            .single()
            .execute()
        )
        if not result.data:
            raise HTTPException(status_code=404, detail="Font not found")
        return result.data

    async def list_fonts(self) -> list[dict]:
        result = (
            self.supabase.table("fonts")
            .select("*")
            .order("created_at", desc=True)
            .execute()
        )
        return result.data

    async def delete_font(self, font_id: str, user_id: str):
        # Fetch font record
        result = (
            self.supabase.table("fonts")
            .select("*")
            .eq("id", font_id)
            .single()
            .execute()
        )
        if not result.data:
            raise HTTPException(status_code=404, detail="Font not found")

        font = result.data

        # Remove from Supabase Storage
        try:
            self.supabase.storage.from_("fonts").remove([font["file_storage_path"]])
        except Exception:
            logger.warning("Failed to remove font from storage: %s", font["file_storage_path"])

        # Remove local file
        local_path = os.path.join(self.settings.fonts_dir, font["filename"])
        if os.path.exists(local_path):
            os.remove(local_path)

        # Delete DB row
        self.supabase.table("fonts").delete().eq("id", font_id).execute()

        # Refresh caches
        _refresh_onlyoffice_fonts(self.settings.onlyoffice_container_name)
        _refresh_fontconfig()

    async def sync_fonts_from_storage(self):
        """Download any fonts from Supabase Storage that are missing locally."""
        fonts_dir = self.settings.fonts_dir
        os.makedirs(fonts_dir, exist_ok=True)

        result = self.supabase.table("fonts").select("*").execute()
        fonts = result.data or []

        synced = 0
        for font in fonts:
            local_path = os.path.join(fonts_dir, font["filename"])
            if os.path.exists(local_path):
                continue
            try:
                data = self.supabase.storage.from_("fonts").download(
                    font["file_storage_path"]
                )
                with open(local_path, "wb") as f:
                    f.write(data)
                synced += 1
            except Exception:
                logger.warning("Failed to sync font: %s", font["filename"])

        if synced > 0:
            logger.info("Synced %d font(s) from storage", synced)
            _refresh_onlyoffice_fonts(self.settings.onlyoffice_container_name)
            _refresh_fontconfig()

    async def refresh_font_families(self):
        """Re-extract real font family names and aliases for all fonts using fonttools."""
        fonts_dir = self.settings.fonts_dir
        result = self.supabase.table("fonts").select("*").execute()
        fonts = result.data or []

        updated = 0
        for font in fonts:
            local_path = os.path.join(fonts_dir, font["filename"])
            if not os.path.exists(local_path):
                continue
            try:
                with open(local_path, "rb") as f:
                    data = f.read()
                family = _extract_font_family(data, font["name"])
                aliases = _extract_font_aliases(data, font["name"])
                updates = {}
                if family != font.get("family"):
                    updates["family"] = family
                if aliases != font.get("font_aliases", []):
                    updates["font_aliases"] = aliases
                if updates:
                    self.supabase.table("fonts").update(updates).eq(
                        "id", font["id"]
                    ).execute()
                    updated += 1
                    logger.info("Updated font %s: %s", font["filename"], updates)
            except Exception as e:
                logger.warning("Failed to refresh family for %s: %s", font["filename"], e)

        if updated > 0:
            logger.info("Refreshed %d font name(s)", updated)


def _extract_fonts_from_zip(data: bytes) -> list[tuple[str, bytes]]:
    """Extract font files from a zip archive, skipping macOS metadata and directories."""
    fonts: list[tuple[str, bytes]] = []
    with zipfile.ZipFile(io.BytesIO(data)) as zf:
        for info in zf.infolist():
            if info.is_dir():
                continue
            # Skip macOS resource fork / metadata files
            basename = os.path.basename(info.filename)
            if basename.startswith(".") or "__MACOSX" in info.filename:
                continue
            ext = os.path.splitext(basename)[1].lower()
            if ext in ALLOWED_EXTENSIONS:
                fonts.append((basename, zf.read(info)))
    return fonts


def _refresh_onlyoffice_fonts(container_name: str) -> bool:
    """Run font regeneration inside the ONLYOFFICE container."""
    try:
        subprocess.run(
            [
                "docker",
                "exec",
                container_name,
                "/usr/bin/documentserver-generate-allfonts.sh",
            ],
            capture_output=True,
            timeout=120,
        )
        logger.info("ONLYOFFICE font cache refreshed")
        return True
    except Exception as e:
        logger.warning("Failed to refresh ONLYOFFICE fonts: %s", e)
        return False


def _refresh_fontconfig():
    """Refresh the system fontconfig cache so LibreOffice picks up new fonts."""
    try:
        subprocess.run(["fc-cache", "-f"], capture_output=True, timeout=30)
        logger.info("Fontconfig cache refreshed")
    except Exception as e:
        logger.warning("Failed to refresh fontconfig: %s", e)
