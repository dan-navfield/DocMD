from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status

from app.config import Settings, get_settings
from app.dependencies import get_current_user, get_supabase_admin
from app.models.onboarding import (
    OnboardingStatusResponse,
    SeedMappingRequest,
    SeedMappingResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/onboarding", tags=["onboarding"])


def _get_preferences(supabase, user_id: str) -> dict:
    """Read the preferences JSONB from user_settings, returning {} if no row."""
    result = (
        supabase.table("user_settings")
        .select("preferences")
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    if result.data and result.data.get("preferences"):
        return result.data["preferences"]
    return {}


def _upsert_preferences(supabase, user_id: str, prefs: dict) -> None:
    """Merge keys into the preferences JSONB, creating the row if needed."""
    existing = _get_preferences(supabase, user_id)
    merged = {**existing, **prefs}
    supabase.table("user_settings").upsert(
        {"user_id": user_id, "preferences": merged},
        on_conflict="user_id",
    ).execute()


@router.get("/status", response_model=OnboardingStatusResponse)
async def get_onboarding_status(
    user: dict = Depends(get_current_user),
    supabase=Depends(get_supabase_admin),
):
    """
    Return whether onboarding is complete for the current user.
    Auto-marks complete if the user already has documents or templates.
    """
    prefs = _get_preferences(supabase, user["id"])

    if prefs.get("onboarding_completed"):
        return OnboardingStatusResponse(
            completed=True,
            completed_at=prefs.get("onboarding_completed_at"),
        )

    # Auto-complete for existing users who have content
    docs = (
        supabase.table("documents")
        .select("id", count="exact")
        .eq("created_by", user["id"])
        .limit(1)
        .execute()
    )
    templates = (
        supabase.table("templates")
        .select("id", count="exact")
        .eq("created_by", user["id"])
        .limit(1)
        .execute()
    )

    if (docs.count and docs.count > 0) or (templates.count and templates.count > 0):
        now = datetime.now(timezone.utc).isoformat()
        _upsert_preferences(supabase, user["id"], {
            "onboarding_completed": True,
            "onboarding_completed_at": now,
        })
        return OnboardingStatusResponse(completed=True, completed_at=now)

    return OnboardingStatusResponse(completed=False)


@router.post("/complete", response_model=OnboardingStatusResponse)
async def complete_onboarding(
    user: dict = Depends(get_current_user),
    supabase=Depends(get_supabase_admin),
):
    """Mark onboarding as complete for the current user."""
    now = datetime.now(timezone.utc).isoformat()
    _upsert_preferences(supabase, user["id"], {
        "onboarding_completed": True,
        "onboarding_completed_at": now,
    })
    return OnboardingStatusResponse(completed=True, completed_at=now)


@router.post("/seed-mapping", response_model=SeedMappingResponse)
async def seed_mapping(
    body: SeedMappingRequest,
    user: dict = Depends(get_current_user),
    supabase=Depends(get_supabase_admin),
    settings: Settings = Depends(get_settings),
):
    """
    Create a mapping with auto-matched styles from a template.
    If no template_id, creates a mapping with sensible defaults.
    """
    # Build default rules
    rules = {
        "heading": {"1": "Heading 1", "2": "Heading 2", "3": "Heading 3"},
        "document_title": "Title",
        "document_subtitle": "Subtitle",
        "paragraph": "Normal",
        "list_bullet": "List Bullet",
        "list_bullet_2": "List Bullet 2",
        "list_bullet_3": "List Bullet 3",
        "list_ordered": "List Number",
        "list_ordered_2": "List Number 2",
        "list_ordered_3": "List Number 3",
        "code_block": "HTML Preformatted",
        "blockquote": "Quote",
        "table": {"style": "Table Grid", "header_row": True},
        "page_break_before": [],
        "metadata_mapping": {},
    }

    # If a template was provided, try to match styles from it
    if body.template_id:
        try:
            # Download the template file
            tmpl = (
                supabase.table("templates")
                .select("file_storage_path")
                .eq("id", body.template_id)
                .eq("created_by", user["id"])
                .single()
                .execute()
            )
            if not tmpl.data:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Template not found",
                )

            storage_path = tmpl.data["file_storage_path"]
            file_bytes = supabase.storage.from_("templates").download(storage_path)

            from app.engine.template_reader import extract_styles

            available = extract_styles(file_bytes)
            available_lower = {s.lower(): s for s in available}

            # Smart matching: map default style names to actual template styles
            def match(default_name: str) -> str:
                if default_name in available:
                    return default_name
                lower = default_name.lower()
                if lower in available_lower:
                    return available_lower[lower]
                # Fuzzy: check if default name is contained in any style
                for style_lower, style_actual in available_lower.items():
                    if lower in style_lower or style_lower in lower:
                        return style_actual
                return default_name

            rules["document_title"] = match("Title")
            rules["document_subtitle"] = match("Subtitle")
            rules["paragraph"] = match("Normal")
            rules["blockquote"] = match("Quote")
            rules["code_block"] = match("HTML Preformatted")
            rules["list_bullet"] = match("List Bullet")
            rules["list_bullet_2"] = match("List Bullet 2")
            rules["list_bullet_3"] = match("List Bullet 3")
            rules["list_ordered"] = match("List Number")
            rules["list_ordered_2"] = match("List Number 2")
            rules["list_ordered_3"] = match("List Number 3")

            for level in ["1", "2", "3"]:
                rules["heading"][level] = match(f"Heading {level}")

        except HTTPException:
            raise
        except Exception as e:
            logger.warning("Failed to extract styles from template: %s", e)
            # Fall through with defaults

    # Create the mapping
    mapping_data = {
        "name": body.name,
        "template_id": body.template_id,
        "rules": rules,
        "is_default": False,
        "created_by": user["id"],
    }

    result = supabase.table("mappings").insert(mapping_data).execute()

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create mapping",
        )

    mapping = result.data[0] if isinstance(result.data, list) else result.data
    return SeedMappingResponse(mapping_id=mapping["id"], mapping=mapping)
