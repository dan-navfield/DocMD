"""Base protocol for LLM providers."""
from __future__ import annotations

from typing import Any, Protocol


class LLMProvider(Protocol):
    """Protocol that all LLM providers must implement."""

    async def classify(self, content: str, context: dict) -> dict:
        """Classify a document and recommend template/mapping."""
        ...

    async def organize(self, document_types: list[str], context: dict) -> dict:
        """Propose a folder structure for a project."""
        ...


CLASSIFY_SYSTEM_PROMPT = """You are a document classification assistant for DocMD.
Your job is to analyze Markdown content and determine:
1. What type of document it is (e.g., Architecture Decision Record, Requirements, Test Plan, API Specification, Runbook, Design Document, User Guide, Release Notes, Meeting Notes)
2. A confidence score (0.0 to 1.0)
3. The best template and mapping to use from the available options
4. A recommended folder path and filename

Respond in JSON format:
{
  "doc_type": "string",
  "confidence": 0.0,
  "recommended_template_id": "string or null",
  "recommended_mapping_id": "string or null",
  "recommended_folder": "string",
  "recommended_filename": "string"
}"""

ORGANIZE_SYSTEM_PROMPT = """You are a document organization assistant for DocMD.
Given a list of document types and project context, propose a folder structure.

Respond in JSON format:
{
  "proposed_structure": {
    "folder_name": ["subfolder1", "subfolder2"]
  },
  "folders_to_create": ["/path/to/folder1", "/path/to/folder2"]
}"""


def build_classify_prompt(content: str, context: dict) -> str:
    templates_info = ""
    if context.get("templates"):
        templates_info = "Available templates:\n"
        for t in context["templates"]:
            templates_info += f"- {t['name']} (id: {t['id']}): {t.get('description', '')}\n"

    mappings_info = ""
    if context.get("mappings"):
        mappings_info = "Available mappings:\n"
        for m in context["mappings"]:
            mappings_info += f"- {m['name']} (id: {m['id']})\n"

    project_info = ""
    if context.get("project"):
        p = context["project"]
        project_info = f"Project: {p['name']}\nNaming rules: {p.get('naming_rules', {})}\n"

    # Truncate content to avoid token limits
    max_content = content[:8000]

    return f"""{templates_info}
{mappings_info}
{project_info}

Document content (Markdown):
---
{max_content}
---

Analyze this document and provide your classification."""


def build_organize_prompt(document_types: list[str], context: dict) -> str:
    project_info = ""
    if context.get("project"):
        p = context["project"]
        project_info = f"Project: {p['name']}\nNaming rules: {p.get('naming_rules', {})}\n"

    types_str = ", ".join(document_types) if document_types else "General documents"

    return f"""{project_info}

Document types to organize: {types_str}

Propose an organized folder structure for these document types."""
